// Abstract out commmon functionality in a functional style

import { Editor, EditorPosition, EditorRange, Notice } from 'obsidian';

export function cnotify(msg: string) {
	new Notice(msg);
}

export function ceditorPos(editor: Editor) {
    const pos = editor.getCursor();
    console.log({pos});
    return pos;
}

export function cWordAt(editor: Editor, editorPos: EditorPosition) {
    return editor.wordAt(editorPos);
}

export function cCurWord(editor: Editor): [string, EditorRange] | undefined {
    const pos = editor.getCursor();
    const wordPos = editor.wordAt(pos);
    if (wordPos?.from && wordPos?.to) {
        const curWord = editor.getRange(wordPos?.from, wordPos?.to);
        return [curWord, wordPos];
    }
    return undefined;
}

export function cReplaceWordAtCur(editor: Editor, newWord: string) {
    const pos = editor.getCursor();
    const wordPos = editor.wordAt(pos);
    if (wordPos?.from && wordPos?.to) {
        editor.replaceRange(newWord, wordPos.from, wordPos.to);
    }
}

export function cReplaceWord(editor: Editor, newWord: string, oldWordRange: EditorRange) {
    editor.replaceRange(newWord, oldWordRange.from, oldWordRange.to);
}