import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'ko',
  name: '__MSG_extensionName__',
  browser_specific_settings: {
    gecko: {
      id: 'jjj672604@gmail.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsPeZsgLj1Q+xBVOKs+kvggWjhOgnKBj6lgAqs/i31MrQzZwjFhZn0uPQo8TxdtCxJrP4ZUpdOs7OkmfZT57IxyCYy0TISYMHdqE+dUTyWgDU1jk731IqgfnsalFpvYsarlUmrL2LGnS9R4zA0vBEix6x14QvTwHFpG1LSQ7wUWUWrOQNDQYp4ppk48GLIKdDJ95lgFU5hUJBISaqo+LgYZVn5aTI3r8USHRRIF3ey+tTckOlB0MpJ5JK8rh2tH+cvORQC9YsTBj6lSJ53UUlKlZGJRh8QIiJ4+94EM8HiPm4WveGCYlLsOCt/dHZ4lMzl16czYBwbZjxNqx91JD3swIDAQAB",
  description: '__MSG_extensionDescription__',
  host_permissions: ['<all_urls>'],
  permissions: ['storage', 'scripting', 'tabs', 'notifications', 'sidePanel'],
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'icon-34.png',
  },
  icons: {
    '128': 'icon-128.png',
  },
  content_scripts: [
    {
      matches: ['https://kkutu.co.kr/o/*'],
      js: ['content/kkuko.iife.js'],
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
      matches: ['*://*/*'],
    },
  ],
} satisfies ManifestType;

export default manifest;
