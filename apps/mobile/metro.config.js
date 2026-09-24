const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Keep all native imports on Expo's React version, including imports from
// hoisted libraries if another workspace changes its React dependency.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^react(?:\/|$)/.test(moduleName))
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
    };
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
