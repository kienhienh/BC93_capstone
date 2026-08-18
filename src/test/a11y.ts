import { axe, type JestAxeConfigureOptions } from "jest-axe";

/**
 * jsdom does not perform real rendering, so color-contrast cannot be
 * computed reliably; it is verified separately by the human release
 * checks this project's WCAG ticket explicitly does not claim to replace.
 * Every other rule stays enabled.
 */
const jsdomAxeOptions: JestAxeConfigureOptions = {
  rules: { "color-contrast": { enabled: false } },
};

export async function runAxe(container: Element) {
  return axe(container, jsdomAxeOptions);
}
