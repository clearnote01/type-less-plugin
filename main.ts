import { DefaultMap } from "defaultMap";
import { cCurWord, cReplaceWord } from "lib";
import {
	App,
	Editor,
	EditorRange,
	MarkdownView,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
	TextComponent,
} from "obsidian";

interface PluginSettings {
	specialCharStart: string;
	specialCharEnd: string;
	mySetting: string;
	shortcutMap: Record<string, string>;
	wordsAutoCompleted: number;
}

const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: "default",
	specialCharStart: ";",
	specialCharEnd: " ",
	shortcutMap: { ...DefaultMap },
	wordsAutoCompleted: 0,
};

const state = { state: "notwatching" };

export default class TypeLessPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();

		function handleKeyDown(pluginSelf: TypeLessPlugin, event: KeyboardEvent) {
			const specialCharStart = pluginSelf.settings.specialCharStart;
			const specialCharEnd = pluginSelf.settings.specialCharEnd;
			const shortcutMap = pluginSelf.settings.shortcutMap;

			if (![specialCharStart, specialCharEnd].includes(event.key)) {
				return;
			}
			if (event.key === specialCharStart) {
				state.state = "watching";
			}
			const editor: Editor | undefined =
				pluginSelf.app.workspace.activeEditor?.editor;
			if (!editor) {
				return;
			}
			if (event.key === specialCharEnd) {
				if (state.state === "watching") {
					// means there was a valid shortcut being input
					const result = cCurWord(editor);
					if (result) {
						const curWord = result[0];
						if (shortcutMap.hasOwnProperty(curWord)) {
							const newWord = shortcutMap[curWord];
							const curWordRange: EditorRange = result[1];
							// current word pos it doesn't include them, so basically ;foo returns foo
							const newPos = {
								line: curWordRange.from.line,
								ch: curWordRange.from.ch - 1,
							};
							const newCurWordRange: EditorRange = {
								from: newPos,
								to: curWordRange.to,
							};

							cReplaceWord(editor, newWord, newCurWordRange);
							pluginSelf.settings.wordsAutoCompleted += 1;
							pluginSelf.saveSettings();

							statusBarItemEl.setText(
								`Words Autocompleted: ${pluginSelf.settings.wordsAutoCompleted}`
							);
						}
					}
				}
				state.state = "notwatching";
			}
		}

		const workspaceContainer = this.app.workspace.containerEl;
		this.registerDomEvent(
			workspaceContainer,
			"keydown",
			(event: KeyboardEvent) => handleKeyDown(this, event)
		);

		await this.loadSettings();


		this.addCommand({
			id: "Add Shortcuts",
			name: "Add Shortcuts",
			checkCallback: (checking: boolean) => {
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new ConfigurationModal(this.app, this).open();
					}

					return true;
				}
			},
		});

		this.addCommand({
			id: "Quick Add Shortcut",
			name: "Quick Add Shortcut",
			checkCallback: (checking: boolean) => {
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new QuickConfigurationModal(this.app, this).open();
					}

					return true;
				}
			},
		});

		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class ConfigurationModal extends Modal {
	result: string;
	plugin: TypeLessPlugin;
	onSubmit: (result: string) => void;

	constructor(app: App, plugin: TypeLessPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Configure Shortcuts" });

		new Setting(contentEl)
			.setName("Shortcuts Map")
			.setDesc(
				"Configure the shortcuts here, this is a map with left side as shortcut and right side as the completion"
			)
			.addTextArea((text) =>
				text
					.setValue(
						JSON.stringify(
							this.plugin.settings.shortcutMap,
							null,
							4
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.shortcutMap = JSON.parse(value);
						await this.plugin.saveSettings();
					})
			);
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					this.close();
				})
		);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

export class QuickConfigurationModal extends Modal {
	result: string;
	plugin: TypeLessPlugin;
	leftSide?: TextComponent;
	rightSide?: TextComponent;
	onSubmit: (result: string) => void;

	constructor(app: App, plugin: TypeLessPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Quick Add Shortcut" });

		new Setting(contentEl)
			.addText((text) => {
				text.setPlaceholder("Shortcut");
				this.leftSide = text;
			})
			.addText((text) => {
				text.setPlaceholder("Expansion");
				this.rightSide = text;
			});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					const leftVal = this.leftSide?.getValue();
					const rightVal = this.rightSide?.getValue();
					if (leftVal && rightVal) {
						this.plugin.settings.shortcutMap[leftVal] = rightVal;
					}
					this.close();
				})
		);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

interface SettingItem<T = keyof Omit<PluginSettings, "shortcutMap">> {
	plugin: TypeLessPlugin;
	containerEl: HTMLElement;
	name: string;
	desc: string;
	placeholder: string;
	settingKey: T;
}

function addSetting({
	plugin,
	containerEl,
	name,
	desc,
	placeholder,
	settingKey,
}: SettingItem<'specialCharEnd' | 'specialCharStart'>) {
	new Setting(containerEl)
		.setName(name)
		.setDesc(desc)
		.addText((text) =>
			text
				.setPlaceholder(placeholder)
				.setValue(plugin.settings[settingKey] as string)
				.onChange(async (value) => {
					if (value === "") {
						throw new Error("field cannot be empty");
					}
					plugin.settings[settingKey] = value;
					await plugin.saveSettings();
				})
		);
}

function addShortCutSettingBlock({
	plugin,
	containerEl,
	name,
	desc,
	placeholder,
	settingKey,
}: SettingItem<keyof Pick<PluginSettings, "shortcutMap">>) {
	new Setting(containerEl)
		.setName(name)
		.setDesc(desc)
		.addTextArea((text) =>
			text
				.setValue(JSON.stringify(plugin.settings[settingKey], null, 4))
				.onChange(async (value) => {
					plugin.settings[settingKey] = JSON.parse(value);
					await plugin.saveSettings();
				})
		);
}

class SettingsTab extends PluginSettingTab {
	plugin: TypeLessPlugin;

	constructor(app: App, plugin: TypeLessPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		addSetting({
			plugin: this.plugin,
			containerEl,
			name: "Special Character Start",
			desc: "Default <;>. Specify a shortcut using this special character at the start of the word",
			placeholder: ";",
			settingKey: "specialCharStart",
		});
		addSetting({
			plugin: this.plugin,
			containerEl,
			name: "Special Character End",
			desc: "Default <SPACE CHAR>. Specify a shortcut using this special character at the end of the word",
			placeholder: " ",
			settingKey: "specialCharEnd",
		});
		addShortCutSettingBlock({
			plugin: this.plugin,
			containerEl,
			name: "Shortcut Map",
			desc: "Configure the shortcuts here, this is a map with left side as shortcut and right side as the completion",
			placeholder: "",
			settingKey: "shortcutMap",
		});
	}
}
