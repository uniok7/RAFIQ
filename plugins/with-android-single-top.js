const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidSingleTop(config) {
  return withAndroidManifest(config, (next) => {
    const application = next.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find((activity) => activity.$?.['android:name'] === '.MainActivity');
    if (mainActivity?.$) mainActivity.$['android:launchMode'] = 'singleTop';
    const blocked = new Set(['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
    next.modResults.manifest['uses-permission'] = (next.modResults.manifest['uses-permission'] ?? []).filter(
      (permission) => !blocked.has(permission.$?.['android:name']),
    );
    return next;
  });
};
