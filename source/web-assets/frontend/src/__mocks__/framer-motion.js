/**
 * Jest mock for framer-motion so tests don't have to depend on its ESM runtime.
 * Each `motion.X` becomes an ordinary React element that forwards children.
 */
const React = require('react');

const stripMotionProps = (props) => {
  const {
    animate, initial, exit, transition, whileHover, whileTap, whileInView,
    variants, drag, dragConstraints, layout, layoutId, ...rest
  } = props || {};
  return rest;
};

const passthrough = (tag) => ({ children, ...props }) =>
  React.createElement(tag, stripMotionProps(props), children);

const motionProxy = new Proxy({}, {
  get: (_, prop) => {
    if (prop === '__esModule') return true;
    return passthrough(typeof prop === 'string' ? prop : 'div');
  },
});

module.exports = {
  motion: motionProxy,
  AnimatePresence: ({ children }) => children,
  useAnimation: () => ({ start: () => {}, stop: () => {} }),
};
