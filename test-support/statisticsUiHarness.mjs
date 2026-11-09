import { afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from '@babel/core';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
// JSDOM không đo layout; chart tests truyền width rõ ràng, không giả lập kết quả đo.
dom.window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  ShadowRoot: dom.window.ShadowRoot, Element: dom.window.Element, Node: dom.window.Node, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle,
  IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native') return next('react-native-web', context);
    if (specifier === 'react-native-svg') return { url: 'statistics-ui:svg', shortCircuit: true };
    if (specifier === '@react-native/assets-registry/registry') return next('react-native-web/dist/cjs/modules/AssetRegistry/index.js', context);
    if (['expo-haptics', 'expo-secure-store', 'expo-constants', 'react-native-safe-area-context', '@react-native-async-storage/async-storage'].includes(specifier)) return { url: `statistics-ui-mock:${specifier}`, shortCircuit: true };
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !/\.[a-z]+$/.test(specifier)) {
      const base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      const extensions = context.parentURL.includes('/react-native-svg/') ? ['.web.js', '.js'] : ['.tsx', '.ts', '.js'];
      for (const extension of extensions) if (existsSync(base + extension)) return { url: pathToFileURL(base + extension).href, shortCircuit: true };
      for (const extension of extensions) if (existsSync(resolve(base, `index${extension}`))) return { url: pathToFileURL(resolve(base, `index${extension}`)).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'statistics-ui-mock:expo-constants') return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url === 'statistics-ui-mock:expo-secure-store') return { format: 'module', shortCircuit: true, source: `
      export async function isAvailableAsync() { return true; }
      export async function getItemAsync() { return null; }
      export async function setItemAsync() {}
      export async function deleteItemAsync() {}
    ` };
    if (url === 'statistics-ui-mock:react-native-safe-area-context') return { format: 'module', shortCircuit: true, source: `
      import React from ${JSON.stringify(new URL('../node_modules/react/index.js', import.meta.url).href)};
      import web from ${JSON.stringify(new URL('../node_modules/react-native-web/dist/cjs/index.js', import.meta.url).href)};
      export function SafeAreaView({edges, ...props}) { return React.createElement(web.View, props); }
      export function useSafeAreaInsets() { return {top: 0, left: 0, right: 0, bottom: 0}; }
    ` };
    // Chỉ nối interop ESM/CJS, vẫn render các lớp SVG web thật.
    if (url === 'statistics-ui:svg') return { format: 'module', shortCircuit: true, source: `
      import svg from ${JSON.stringify(new URL('../node_modules/react-native-svg/lib/commonjs/ReactNativeSVG.web.js', import.meta.url).href)};
      export default svg.default;
      export const {Circle, Line, Path, Rect} = svg;
    ` };
    if (url === 'statistics-ui-mock:expo-haptics') return { format: 'module', shortCircuit: true, source: 'export const impactAsync = async () => {}; export const ImpactFeedbackStyle = {Light: 0};' };
    if (url === 'statistics-ui-mock:@react-native-async-storage/async-storage') return { format: 'module', shortCircuit: true,
      source: 'export default {getItem: async () => null, setItem: async () => {}, removeItem: async () => {}};' };
    if ((url.endsWith('.tsx') || url.endsWith('.ts')) && !url.includes('/node_modules/')) return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(fileURLToPath(url), 'utf8'), {
      filename: fileURLToPath(url), babelrc: false, configFile: false,
      presets: [['@babel/preset-typescript', { isTSX: url.endsWith('.tsx'), allExtensions: true }]],
      plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
    }).code };
    return next(url, context);
  },
});
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const ui = await import('../components/statistics/index.ts');
const { useThemeStore } = await import('../store/themeStore.ts');
const { colors, darkColors } = await import('../constants/theme.ts');
const { StyleSheet } = await import('react-native-web');
let root;
let container;
async function render(element, dark = false) {
  if (!container) { container = document.createElement('div'); document.body.append(container); root = createRoot(container); }
  await act(async () => {
    useThemeStore.setState({ colors: dark ? darkColors : colors, isDark: dark, themeMode: dark ? 'dark' : 'light' });
    root.render(element);
  });
  return container;
}
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  container?.remove(); container = null; root = null;
});

export { h, act, ui, render, useThemeStore, colors, darkColors, StyleSheet };
