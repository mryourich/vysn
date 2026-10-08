/**
 * Signiert Android-Release-Builds mit dem Upload-Schlüssel aus mobile/keystore.properties
 * (storeFile, storePassword, keyAlias, keyPassword – Pfad relativ zu mobile/).
 * Die Datei und der Schlüssel werden nie eingecheckt. Fehlt sie, bleibt es bei der Debug-Signatur.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
def vysnerKeystoreFile = rootProject.file("../keystore.properties")
def vysnerKeystore = new Properties()
if (vysnerKeystoreFile.exists()) { vysnerKeystore.load(new FileInputStream(vysnerKeystoreFile)) }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('vysnerKeystore')) return cfg;
    src = src.replace(/android\s*\{/, `${BLOCK}\nandroid {`);
    src = src.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (vysnerKeystoreFile.exists()) {
                storeFile rootProject.file("../" + vysnerKeystore['storeFile'])
                storePassword vysnerKeystore['storePassword']
                keyAlias vysnerKeystore['keyAlias']
                keyPassword vysnerKeystore['keyPassword']
            }
        }`);
    src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig vysnerKeystoreFile.exists() ? signingConfigs.release : signingConfigs.debug');
    cfg.modResults.contents = src;
    return cfg;
  });
};
