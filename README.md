# babel-plugin-mithril-add-data-attribute

This plugin adds a `data-component` attribute to top-level DOM elements rendered by mithril component function `m`. Intended for development - bloats HTML. Helps debug: find your components in a large repo from generated HTML. Adds component name or file name to component data attributes which will be visible in the generated HTML.

- tries to figure out component name from function, class or variable def
- if no name found it tries to use the file name, so you'll know where to start
- when not resolvable: assumes `attrs` to be an object and `getAttrs` to be a function returning an `attrs` object

Needs more tests and better support, feel free to add issues with failing test code or commit a PR.
Written in TypeScript.

## Examples

**In**

```js
const Comp2 = () => m("div");

const MyComponent = () => {
  return m("div", m(Comp2));
};
```

**Out**

```js
const Comp2 = () =>
  m("div", {
    "data-component": "Comp2",
  });

const MyComponent = () => {
  return m(
    "div",
    {
      "data-component": "MyComponent",
    },
    m(Comp2)
  );
};
```

For many more examples se `test/index.test.js`

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

Under development. Requests?

## Contribute

Please do. Add an issue or PR.
