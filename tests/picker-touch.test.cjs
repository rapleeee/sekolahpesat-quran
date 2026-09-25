const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Simulate touch browser ordering: input blur (no relatedTarget), then click.
class Element {
    constructor() {
        this.listeners = {};
        this.children = [];
        this.dataset = {};
        this.value = '';
        this.hidden = false;
    }
    addEventListener(type, handler) {
        (this.listeners[type] ||= []).push(handler);
    }
    dispatch(type, event = {}) {
        for (const handler of this.listeners[type] || []) handler(event);
    }
    setAttribute(name, value) { this[name] = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    replaceChildren() { this.children = []; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    focus() { document.activeElement = this; }
    querySelector() { return this.children[0]; }
    querySelectorAll() { return this.children; }
}
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
const document = new Element();
document.getElementById = id => elements.get(id) || null;
document.querySelector = () => new Element();
document.createElement = () => new Element();
const picker = elements.get('surah-picker');
const search = elements.get('surah-search');
const results = elements.get('surah-results');
const dropdown = elements.get('surah-dropdown');
const trigger = elements.get('surah-select');
picker.append(trigger, dropdown);
dropdown.append(search, results);
dropdown.hidden = true;
const pendingTimers = [];
const context = vm.createContext({ document, console, window: { matchMedia: () => ({ matches: true }) }, setTimeout: callback => pendingTimers.push(callback) });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8'), context);
// Isolate unrelated initializers; exercise actual picker initialization and handlers.
vm.runInContext(`
    setupMurajaahSession = setupAudio = setupSavedReading = setupReaderMode = fetchSurahs = () => {};
    globalThis.requestedSurahs = [];
    fetchSurahDetail = number => requestedSurahs.push(number);
    allSurahs = [{nomor:1, namaLatin:'Al-Fatihah', nama:'الفاتحة', jumlahAyat:7, arti:'Pembukaan'}];
`, context);
document.dispatch('DOMContentLoaded');
trigger.dispatch('click');
assert.equal(dropdown.hidden, false);
search.value = 'fatihah';
search.dispatch('input');
picker.dispatch('focusout', { relatedTarget: null });
assert.equal(dropdown.hidden, false, 'Touch blur must not hide the option before its click');
const option = results.children[0];
picker.dispatch('focusout', { relatedTarget: option });
assert.equal(dropdown.hidden, false, 'Internal focus must keep dropdown open');
option.dispatch('click');
assert.equal(dropdown.hidden, true);
assert.equal(elements.get('selected-surah').textContent, '1. Al-Fatihah');
assert.equal(context.requestedSurahs.length, 1);
assert.equal(context.requestedSurahs[0], 1);
trigger.dispatch('click');
picker.dispatch('focusout', { relatedTarget: null });
document.dispatch('click', { target: new Element() });
assert.equal(dropdown.hidden, true, 'Outside tap must still dismiss dropdown');
trigger.dispatch('click');
picker.dispatch('focusout', { relatedTarget: new Element() });
assert.equal(dropdown.hidden, false, 'Pointer focus change must not close the picker');
picker.dispatch('keydown', { key: 'Tab' });
document.activeElement = new Element();
pendingTimers.shift()();
assert.equal(dropdown.hidden, true, 'Keyboard focus leaving picker must dismiss it');
trigger.dispatch('click');
picker.dispatch('keydown', { key: 'Escape' });
assert.equal(dropdown.hidden, true);
assert.equal(document.activeElement, trigger);
console.log('PASS: touch blur → selection, internal focus, outside tap, keyboard exit and Escape.');

for (const mode of ['reading', 'mushaf']) {
    vm.runInContext(`readerMode = '${mode}'`, context);
    trigger.dispatch('click');
    picker.dispatch('focusout', { relatedTarget: new Element() });
    assert.equal(dropdown.hidden, false, `${mode}: touch focus change keeps options visible`);
    results.children[0].dispatch('click');
    assert.equal(dropdown.hidden, true);
}
assert.equal(context.requestedSurahs.length, 3);
console.log('PASS: touch selection survives non-null blur targets in reading and mushaf modes.');
