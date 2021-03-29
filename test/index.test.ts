import { resolve } from "path";
import { testTransform } from "../src";

describe("inputs attributes in options object or creates one", () => {
  it("converts m with only 1 arg", () => {
    expect(
      testTransform(
        `const component = m('div');
        `
      )
    ).toMatchInlineSnapshot(`
        "const component = m('div', {
                'data-component': 'component'
        });"
      `);
  });
  it("converts m with 2 args, no options", () => {
    expect(
      testTransform(`
          const component = m('div', 'text');
        `)
    ).toMatchInlineSnapshot(`
        "const component = m('div', {
                  'data-component': 'component'
        }, 'text');"
    `);
  });

  it("converts m with options arg, no data-attribute", () => {
    expect(
      testTransform(`
              const component = m('div', { class: 'btn'}, 'text');
      `)
    ).toMatchInlineSnapshot(`
        "const component = m('div', { class: 'btn', 'data-component': 'component'
        }, 'text');"
      `);
  });

  it("does not overwrite m with existing data-attribute", () => {
    expect(
      testTransform(`
      const component = m('div', { 'data-component': 'roffe'}, 'text');
        `)
    ).toMatchInlineSnapshot(`"const component = m('div', { 'data-component': 'roffe' }, 'text');"`);
  });
});

describe("arrow expressions", () => {
  it("handles non-block statement arrow expressions", () => {
    expect(
      testTransform(`
      const MyComponent = () => m('div');
    `)
    ).toMatchInlineSnapshot(`
      "const MyComponent = () => m('div', {
            'data-component': 'MyComponent'
      });"
    `);
  });

  it("handles block statement arrow expressions", () => {
    expect(
      testTransform(`
      const MyComponent = () => {
        if (true) {
          return m('div');
        } else {
          return m('span', 'nope');
        }
      }
    `)
    ).toMatchInlineSnapshot(`
      "const MyComponent = () => {
        if (true) {
          return m('div', {
            'data-component': 'MyComponent'
          });
        } else {
          return m('span', {
            'data-component': 'MyComponent'
          }, 'nope');
        }
      };"
    `);

    expect(
      testTransform(`
      const Comp2 = {};
      const MyComponent = () => {
          return m('div', m(Comp2));
      }
    `)
    ).toMatchInlineSnapshot(`
      "const Comp2 = {};
      const MyComponent = () => {
          return m('div', {
              'data-component': 'MyComponent'
          }, m(Comp2));
      };"
    `);
  });
});

describe("function expressions", () => {
  it("updates intermediate assignments as appropriate", () => {
    expect(
      testTransform(`
      function MyComponent() {
        const markup = null;
        return markup;
      }
    `)
    ).toMatchInlineSnapshot(`
      "function MyComponent() {
        const markup = null;
        return markup;
      }"
    `);

    expect(
      testTransform(`
      function MyComponent() {
        const markup = m('div', {});
        return markup;
      }
    `)
    ).toMatchInlineSnapshot(`
      "function MyComponent() {
        const markup = m('div', {
          'data-component': 'markup'
        });
        return markup;
      }"
    `);
  });

  it("processes nested-function components", () => {
    expect(
      testTransform(`
      if (true) {
        function MyComponent() {
          return m('div');
        }
      }
    `)
    ).toMatchInlineSnapshot(`
      "if (true) {
        function MyComponent() {
          return m('div', {
            'data-component': 'MyComponent'
          });
        }
      }"
    `);
  });

  it("uses variable name when anon function", () => {
    expect(
      testTransform(`
        const MyComponent = function() {
          return m('div');
        }
      `)
    ).toMatchInlineSnapshot(`
      "const MyComponent = function () {
        return m('div', {
          'data-component': 'MyComponent'
        });
      };"
    `);
  });
});

// describe("can handle class defs", () => {
//   it("uses the variable name when no name exists", () => {
//     expect(
//       testTransform(`
//         const MyComponent = class extends Roffe {
//           view() {
//             return m('div');
//           }
//         }
//       `)
//     ).toMatchInlineSnapshot(`
//       "const MyComponent = class extends Roffe {
//         view() {
//           return m('div', {
//             'data-component': 'MyComponent'
//           });
//         }
//       };"
//     `);
//   });
// });

describe("uses filename ass fallback", () => {
  it("uses the file’s basename when it is not unknown and is not an index file", () => {
    const filename = resolve("MyComponent.js");

    expect(
      testTransform(
        `
      export default class extends m.Component {
        view() {
          return m('div');
        }
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default class extends m.Component {
        view() {
          return m('div', {
            'data-component': 'MyComponent'
          });
        }
      }"
    `);

    expect(
      testTransform(
        `
      export default function() {
        return m('div');
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default function () {
        return m('div', {
          'data-component': 'MyComponent'
        });
      }"
    `);

    expect(
      testTransform(
        `
      export default () => {
        return m('div');
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default (() => {
        return m('div', {
          'data-component': 'MyComponent'
        });
      });"
    `);
  });

  it("uses the file’s directory name when it is an index file", () => {
    const filename = resolve("MyComponent/index.js");

    expect(
      testTransform(
        `
      export default class extends m.Component {
        view() {
          return m('div');
        }
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default class extends m.Component {
        view() {
          return m('div', {
            'data-component': 'MyComponent'
          });
        }
      }"
    `);

    expect(
      testTransform(
        `
      export default function() {
        return m('div');
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default function () {
        return m('div', {
          'data-component': 'MyComponent'
        });
      }"
    `);

    expect(
      testTransform(
        `
      export default () => {
        return m('div');
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      "export default (() => {
        return m('div', {
          'data-component': 'MyComponent'
        });
      });"
    `);
  });
});

describe("options", () => {
  describe("name", () => {
    it("uses the custom name", () => {
      expect(
        testTransform(
          `
        class MyComponent extends m.Component {
          view() {
            return m('div');
          }
        }
      `,
          {
            overrides: {
              MyComponent: {
                name: "SomeOtherComponent",
              },
            },
          }
        )
      ).toMatchSnapshot();
    });
  });
});
