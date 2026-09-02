// Metro config para poder importar la librería de parsing compartida que
// vive en `../src/parsing` (raíz del monorepo), en vez de duplicarla dentro
// de `mobile/`. Así la app y los documentos de arquitectura siempre citan
// exactamente el mismo código.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
