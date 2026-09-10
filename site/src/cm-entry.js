// CodeMirror 6 bundle for the playground (built by site/build.mjs with esbuild into /cm.js). Self-hosted: no third-party runtime.
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars, Decoration, gutter, GutterMarker } from '@codemirror/view';
import { EditorState, Compartment, StateEffect, StateField, RangeSet } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput, foldGutter, foldKeymap, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags as t } from '@lezer/highlight';

// palette from theme.css: petrol code background, brand-blue keywords, warm literals
const aegisTheme = EditorView.theme({
    '&': { backgroundColor: '#12303F', color: '#E8EEF2', fontSize: '13px', height: '100%' },
    '.cm-content': { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0', padding: '12px 0', caretColor: '#8FD3F4' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
    '.cm-gutters': { backgroundColor: '#0E2734', color: '#5C7383', border: 'none', paddingRight: '6px' },
    '.cm-activeLineGutter': { backgroundColor: '#163847', color: '#8FD3F4' },
    '.cm-activeLine': { backgroundColor: 'rgba(143,211,244,.06)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(143,211,244,.22) !important' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#8FD3F4' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(143,211,244,.25)', outline: 'none' },
    '.cm-tooltip': { backgroundColor: '#0E2734', border: '1px solid #22404F', color: '#E8EEF2' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#163847' },
    '.cm-error-line': { backgroundColor: 'rgba(241,112,122,.18)' },
    '.cm-error-gutter': { color: '#F1707A', fontWeight: '700' },
    '.cm-foldPlaceholder': { backgroundColor: '#163847', border: 'none', color: '#8FD3F4' },
}, { dark: true });
const aegisHighlight = HighlightStyle.define([
    { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: '#8FD3F4' },
    { tag: [t.string, t.special(t.string), t.number, t.bool, t.null, t.regexp], color: '#F3C97C' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#8FA3AF', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: '#DCE6EC' },
    { tag: [t.tagName, t.angleBracket], color: '#E9A28F' },
    { tag: [t.attributeName, t.propertyName], color: '#B9D6E6' },
    { tag: [t.attributeValue], color: '#F3C97C' },
    { tag: [t.variableName, t.name], color: '#E8EEF2' },
    { tag: [t.typeName, t.className], color: '#D4B5FF' },
    { tag: t.punctuation, color: '#9FB3C0' },
    { tag: t.invalid, color: '#F1707A' },
]);

// error line marker (set from the iframe's error events)
const setError = StateEffect.define();
const errorField = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
        deco = deco.map(tr.changes);
        for (const e of tr.effects) if (e.is(setError)) {
            if (!e.value) return Decoration.none;
            const line = tr.state.doc.line(Math.min(Math.max(1, e.value), tr.state.doc.lines));
            return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)]);
        }
        return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
});
class ErrMarker extends GutterMarker { toDOM() { const s = document.createElement('span'); s.className = 'cm-error-gutter'; s.textContent = '●'; s.title = 'Error on this line'; return s; } }
const errGutter = gutter({
    class: 'cm-err',
    markers: (view) => { const d = view.state.field(errorField); const set = []; d.between(0, view.state.doc.length, (from) => { set.push(new ErrMarker().range(from)); }); return RangeSet.of(set, true); },
});

const langOf = (name) => name === 'html' ? html() : javascript();

export function createEditor({ parent, doc = '', lang = 'js', onChange, onRun }) {
    const langC = new Compartment();
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc,
            extensions: [
                lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(), EditorState.allowMultipleSelections.of(true),
                indentOnInput(), bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
                syntaxHighlighting(aegisHighlight), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                keymap.of([{ key: 'Mod-Enter', run: () => { onRun && onRun(); return true; } }, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
                langC.of(langOf(lang)), aegisTheme, errorField, errGutter,
                EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); }),
                EditorState.tabSize.of(4),
            ],
        }),
    });
    return {
        view,
        get doc() { return view.state.doc.toString(); },
        set(text, l) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, effects: [setError.of(null), ...(l ? [langC.reconfigure(langOf(l))] : [])] }); },
        markError(line) { view.dispatch({ effects: setError.of(line) }); if (line) { const ln = view.state.doc.line(Math.min(line, view.state.doc.lines)); view.dispatch({ effects: EditorView.scrollIntoView(ln.from, { y: 'center' }) }); } },
        focus() { view.focus(); },
    };
}
export { oneDark };
