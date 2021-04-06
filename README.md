# babel-plugin-mithril-add-data-attribute

BETA. This plugin adds a `data-component` attribute to top-level DOM elements rendered by mithril component function `m`. Intended for development - bloats HTML. Helps debug - find your components in a large repo from generated HTML. Adds component name and file to component data attributes which will be visible in the generated HTML.

- only adds to outer component
- tries to figure out component name from function or variable def
- if no name found it tries to use the file name, so you'll know where to start

Needs more tests and better support for class-declarations.

## Examples

**In**

```js
const MyComponent = () => m("div");

const InnerComp = {};
const OuterComp = () => {
  return m("div", m(InnerComp));
};
```

**Out**

```js
const MyComponent = () =>
  m("div", {
    "data-component": "MyComponent",
  });

const InnerComp = {};
const OuterComp = () => {
  return m(
    "div",
    {
      "data-component": "OuterComp",
    },
    m(InnerComp)
  );
};
```

## Installation

```sh
# yarn
yarn add --dev babel-plugin-mithril-add-data-attribute

# npm
npm install --save-dev babel-plugin-mithril-add-data-attribute
```

## Usage

### Via `.babelrc`

**.babelrc**

```json
{
  "plugins": ["mithril-add-data-attribute"]
}
```

### Via CLI

```sh
babel --plugins mithril-add-data-attribute script.js
```

### Via Node API

```js
require("babel-core").transform("code", {
  plugins: ["mithril-add-data-attribute"],
});
```

## Options

Under development

## Contribute

Please do.
