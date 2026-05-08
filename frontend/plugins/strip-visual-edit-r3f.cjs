/**
 * Babel plugin that strips @emergentbase/visual-edits's `x-*` metadata
 * attributes from three.js JSX primitives (mesh, group, *Geometry, *Material,
 * *Light, *Camera, *Helper, primitive, etc.).
 *
 * Why: R3F v9's `applyProps` is strict — unknown kebab-case props like
 * `x-line-number` are interpreted as nested three.js property paths
 * (`x.line.number`) and throw `Cannot set "x-line-number". Ensure it is an
 * object before setting "line-number".`
 *
 * This plugin runs AFTER visual-edits' JSX visitor has already added the
 * attributes, and removes them only on three.js JSX elements. All other
 * (HTML / component) elements keep the editor metadata intact.
 *
 * Runs only in dev mode (production doesn't include visual-edits).
 */

const THREE_BASE_TAGS = new Set([
  "mesh",
  "group",
  "points",
  "sprite",
  "line",
  "lineSegments",
  "lineLoop",
  "primitive",
  "fog",
  "fogExp2",
  "color",
  "scene",
  "object3D",
  "bone",
  "skinnedMesh",
  "instancedMesh",
  "lOD",
  "bufferAttribute",
  "instancedBufferAttribute",
  "bufferGeometry",
  "audio",
  "audioListener",
  "positionalAudio",
  "raycaster",
]);

const THREE_SUFFIX_RE = /(Geometry|Material|Light|Camera|Helper)$/;

function isThreeTag(name) {
  if (!name || typeof name !== "string") return false;
  if (!/^[a-z]/.test(name)) return false; // only lowercase intrinsics
  if (THREE_BASE_TAGS.has(name)) return true;
  return THREE_SUFFIX_RE.test(name);
}

const VE_ATTR_PREFIX = "x-";

module.exports = function stripVisualEditR3f() {
  return {
    name: "strip-visual-edit-r3f",
    visitor: {
      JSXOpeningElement(path) {
        const nameNode = path.node.name;
        if (!nameNode || nameNode.type !== "JSXIdentifier") return;
        if (!isThreeTag(nameNode.name)) return;

        path.node.attributes = path.node.attributes.filter((attr) => {
          if (attr.type !== "JSXAttribute") return true;
          const attrName = attr.name && attr.name.name;
          if (typeof attrName !== "string") return true;
          return !attrName.startsWith(VE_ATTR_PREFIX);
        });
      },
    },
  };
};
