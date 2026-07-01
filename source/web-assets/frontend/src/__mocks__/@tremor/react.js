/**
 * Jest mock for @tremor/react — avoids pulling in date-fns/react-day-picker ESM
 * which Jest cannot transform under CRA5. We only need primitives that preserve
 * children and key attributes so our tests can assert text content.
 */
const React = require('react');

const pass = (tag = 'div') => ({ children, ...props }) =>
  React.createElement(tag, props, children);

module.exports = {
  Card: pass('div'),
  Title: pass('h2'),
  Badge: pass('span'),
  Flex: pass('div'),
  Text: pass('p'),
  Metric: pass('div'),
  Grid: pass('div'),
  Tab: pass('button'),
  TabGroup: pass('div'),
  TabList: pass('div'),
  TabPanel: pass('div'),
  TabPanels: pass('div'),
  Table: pass('table'),
  TableHead: pass('thead'),
  TableRow: pass('tr'),
  TableHeaderCell: pass('th'),
  TableBody: pass('tbody'),
  TableCell: pass('td'),
};
