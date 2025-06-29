import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import FeishuSharePlugin from './main';
import { ManualAuthModal } from './manual-auth-modal';
import { FolderSelectModal } from './folder-select-modal';

export class FeishuSettingTab extends PluginSettingTab {
	plugin: FeishuSharePlugin;

	constructor(app: App, plugin: FeishuSharePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题和说明
		containerEl.createEl('h2', { text: '飞书分享设置' });
		
		const descEl = containerEl.createDiv('setting-item-description');
		descEl.innerHTML = `
			<p>直连飞书API，回调地址仅中转无记录。</p>
			<p><strong>特点：</strong>无依赖、更安全、响应更快</p>
		`;

		// 应用配置部分
		containerEl.createEl('h3', { text: '🔧 应用配置' });

		// App ID
		new Setting(containerEl)
			.setName('App ID')
			.setDesc('飞书应用的 App ID')
			.addText(text => text
				.setPlaceholder('输入飞书应用的 App ID')
				.setValue(this.plugin.settings.appId)
				.onChange(async (value) => {
					console.log('Setting App ID:', value);
					this.plugin.settings.appId = value.trim();
					await this.plugin.saveSettings();
					console.log('App ID saved:', this.plugin.settings.appId);
				}));

		// App Secret
		new Setting(containerEl)
			.setName('App Secret')
			.setDesc('飞书应用的 App Secret')
			.addText(text => {
				text.setPlaceholder('输入飞书应用的 App Secret')
					.setValue(this.plugin.settings.appSecret)
					.onChange(async (value) => {
						console.log('Setting App Secret:', value ? '***' : 'empty');
						this.plugin.settings.appSecret = value.trim();
						await this.plugin.saveSettings();
						console.log('App Secret saved:', this.plugin.settings.appSecret ? '***' : 'empty');
					});
				text.inputEl.type = 'password';
			});

		// 回调地址
		new Setting(containerEl)
			.setName('OAuth回调地址')
			.setDesc('obsidian需web回调中转，例如：https://md2feishu.xinqi.life/oauth-callback')
			.addText(text => text
				.setPlaceholder('https://md2feishu.xinqi.life/oauth-callback')
				.setValue(this.plugin.settings.callbackUrl)
				.onChange(async (value) => {
					console.log('Setting callback URL:', value);
					this.plugin.settings.callbackUrl = value.trim();
					await this.plugin.saveSettings();
					console.log('Callback URL saved:', this.plugin.settings.callbackUrl);
				}));

		// 授权部分
		containerEl.createEl('h3', { text: '🔐 授权管理' });

		// 当前授权状态
		const authStatusEl = containerEl.createDiv('setting-item');
		const authStatusInfo = authStatusEl.createDiv('setting-item-info');
		authStatusInfo.createDiv('setting-item-name').setText('授权状态');
		
		const statusDesc = authStatusInfo.createDiv('setting-item-description');
		if (this.plugin.settings.userInfo) {
			statusDesc.innerHTML = `
				<span style="color: var(--text-success);">✅ 已授权</span><br>
				<strong>用户：</strong>${this.plugin.settings.userInfo.name}<br>
				<strong>邮箱：</strong>${this.plugin.settings.userInfo.email}
			`;
		} else {
			statusDesc.innerHTML = '<span style="color: var(--text-error);">❌ 未授权</span>';
		}

		// 自动授权按钮（推荐）
		new Setting(containerEl)
			.setName('🚀 一键授权（推荐）')
			.setDesc('自动打开浏览器完成授权，通过云端回调自动返回授权结果，无需手动操作')
			.addButton(button => {
				button
					.setButtonText('🚀 一键授权')
					.setCta()
					.onClick(() => {
						this.startAutoAuth();
					});
			});

		// 手动授权按钮（备用）
		new Setting(containerEl)
			.setName('📝 手动授权（备用）')
			.setDesc('如果一键授权遇到问题，可以使用传统的手动复制粘贴授权方式')
			.addButton(button => {
				button
					.setButtonText('手动授权')
					.onClick(() => {
						this.startManualAuth();
					});
			});

		// 清除授权
		if (this.plugin.settings.userInfo) {
			new Setting(containerEl)
				.setName('清除授权')
				.setDesc('清除当前的授权信息')
				.addButton(button => {
					button
						.setButtonText('🗑️ 清除授权')
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.accessToken = '';
							this.plugin.settings.refreshToken = '';
							this.plugin.settings.userInfo = null;
							await this.plugin.saveSettings();
							this.plugin.feishuApi.updateSettings(this.plugin.settings);
							new Notice('✅ 授权信息已清除');
							this.display(); // 刷新界面
						});
				});
		}

		// 文件夹设置部分（仅在已授权时显示）
		if (this.plugin.settings.userInfo) {
			containerEl.createEl('h3', { text: '📁 默认文件夹' });

			// 当前默认文件夹显示
			new Setting(containerEl)
				.setName('当前默认文件夹')
				.setDesc(`文档将保存到：${this.plugin.settings.defaultFolderName || '我的空间'}${this.plugin.settings.defaultFolderId ? ` (ID: ${this.plugin.settings.defaultFolderId})` : ''}`)
				.addButton(button => {
					button
						.setButtonText('📁 选择文件夹')
						.onClick(() => {
							this.showFolderSelectModal();
						});
				});
		}

		// 使用说明部分
		containerEl.createEl('h3', { text: '📖 使用说明' });

		const usageEl = containerEl.createDiv('setting-item-description');
		usageEl.innerHTML = `
			<ol>
				<li><strong>配置应用：</strong>在飞书开放平台创建应用，获取App ID和App Secret</li>
				<li><strong>配置回调：</strong>在飞书应用中添加回调地址：<code>https://md2feishu.xinqi.life/oauth-callback</code></li>
				<li><strong>完成授权：</strong>点击"🚀 一键授权"按钮，浏览器将自动完成授权流程</li>
				<li><strong>选择文件夹：</strong>授权后可选择默认保存文件夹（可选）</li>
				<li><strong>开始使用：</strong>在文件管理器中右键MD文件选择"分享到飞书"，或使用命令面板</li>
			</ol>
			<div style="
				background: var(--background-secondary);
				border: 1px solid var(--background-modifier-border);
				padding: 12px;
				border-radius: 6px;
				margin-top: 12px;
				border-left: 4px solid var(--color-accent);
			">
				<strong style="color: var(--text-accent);">🎉 功能特色：</strong>
				<ul style="margin: 8px 0 0 20px; color: var(--text-normal);">
					<li style="margin-bottom: 4px;">✅ <strong>自动授权：</strong>无需手动复制粘贴授权码</li>
					<li style="margin-bottom: 4px;">✅ <strong>MD转文档：</strong>自动转换为可编辑的飞书文档</li>
					<li style="margin-bottom: 4px;">✅ <strong>智能处理：</strong>自动处理Obsidian双向链接、标签等语法</li>
					<li style="margin-bottom: 4px;">✅ <strong>可视化选择：</strong>支持浏览和选择目标文件夹</li>
					<li style="margin-bottom: 4px;">✅ <strong>一键复制：</strong>分享成功后可一键复制文档链接</li>
				</ul>
			</div>
		`;
	}

	private startAutoAuth() {
		console.log('Starting auto auth...');
		console.log('Current settings:', {
			appId: this.plugin.settings.appId,
			appSecret: this.plugin.settings.appSecret ? '***' : 'empty',
			hasUserInfo: !!this.plugin.settings.userInfo
		});

		if (!this.plugin.settings.appId || !this.plugin.settings.appSecret) {
			new Notice('❌ 请先配置 App ID 和 App Secret');
			console.error('Missing App ID or App Secret');
			return;
		}

		// 确保API服务有最新的设置
		this.plugin.feishuApi.updateSettings(this.plugin.settings);
		console.log('Updated API service settings');

		try {
			// 生成授权URL并打开浏览器
			const authUrl = this.plugin.feishuApi.generateAuthUrl();
			console.log('Opening auth URL:', authUrl);

			// 打开浏览器进行授权
			window.open(authUrl, '_blank');

			new Notice('🔄 已打开浏览器进行授权，完成后将自动返回Obsidian');

			// 监听授权成功事件
			const successHandler = () => {
				console.log('Auto auth success event received');
				this.display(); // 刷新设置界面
				window.removeEventListener('feishu-auth-success', successHandler);
			};

			window.addEventListener('feishu-auth-success', successHandler);

		} catch (error) {
			console.error('Auto auth error:', error);
			new Notice(`❌ 自动授权失败: ${error.message}`);
		}
	}

	private startManualAuth() {
		console.log('Starting manual auth...');
		console.log('Current settings:', {
			appId: this.plugin.settings.appId,
			appSecret: this.plugin.settings.appSecret ? '***' : 'empty',
			hasUserInfo: !!this.plugin.settings.userInfo
		});

		if (!this.plugin.settings.appId || !this.plugin.settings.appSecret) {
			new Notice('❌ 请先配置 App ID 和 App Secret');
			console.error('Missing App ID or App Secret');
			return;
		}

		// 确保API服务有最新的设置
		this.plugin.feishuApi.updateSettings(this.plugin.settings);
		console.log('Updated API service settings');

		const modal = new ManualAuthModal(
			this.app,
			this.plugin.feishuApi,
			async () => {
				// 授权成功回调
				console.log('Auth success callback triggered');
				await this.plugin.saveSettings();
				this.display(); // 刷新设置界面
			}
		);
		modal.open();
	}

	/**
	 * 显示文件夹选择模态框
	 */
	private showFolderSelectModal(): void {
		const modal = new FolderSelectModal(
			this.app,
			this.plugin.feishuApi,
			async (selectedFolder) => {
				if (selectedFolder) {
					// 用户选择了一个文件夹
					console.log('📁 Folder selected:', selectedFolder);
					console.log('📁 Folder token:', selectedFolder.folder_token || selectedFolder.token);
					console.log('📁 Folder name:', selectedFolder.name);

					// 兼容两种属性名：folder_token 和 token
					this.plugin.settings.defaultFolderId = selectedFolder.folder_token || selectedFolder.token || '';
					this.plugin.settings.defaultFolderName = selectedFolder.name;
				} else {
					// 用户选择了根目录（我的空间）
					console.log('📁 Root folder selected (我的空间)');
					this.plugin.settings.defaultFolderId = '';
					this.plugin.settings.defaultFolderName = '我的空间';
				}

				await this.plugin.saveSettings();
				console.log('📁 Settings saved:', {
					defaultFolderId: this.plugin.settings.defaultFolderId,
					defaultFolderName: this.plugin.settings.defaultFolderName
				});

				new Notice('✅ 默认文件夹设置已保存');
				this.display(); // 刷新设置界面
			}
		);

		modal.open();
	}
}
