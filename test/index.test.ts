import { resolve } from "path";
import { TransformOptions, transform } from "@babel/core";
import babelPluginMithrilComponentDataAttrs from "../src";

// used for test and development
export const testTransform = (code: string, pluginOptions = {}, transformOptions: TransformOptions = {}) => {
  if (!code) {
    return "";
  }

  const result = transform(code, {
    plugins: [babelPluginMithrilComponentDataAttrs, pluginOptions],
    babelrc: false,
    ...transformOptions,
  });

  return result?.code || "";
};

const unstringSnapshotSerializer = {
  test: (val) => typeof val === "string",
  print: (val) => val,
};

if (typeof expect !== "undefined" && expect.addSnapshotSerializer) {
  expect.addSnapshotSerializer(unstringSnapshotSerializer);
}

describe("inputs attributes in options object or creates one", () => {
  it("converts m with only 1 arg", () => {
    expect(
      testTransform(`
    const MyComponent = m("div");
    `)
    ).toMatchInlineSnapshot(`
      const MyComponent = m("div", {
        "data-component": "MyComponent"
      });
    `);
  });

  it("converts m with 2 args, no options", () => {
    expect(
      testTransform(`
          const MyComponent = m("div", "text");
        `)
    ).toMatchInlineSnapshot(`
      const MyComponent = m("div", {
        "data-component": "MyComponent"
      }, "text");
    `);
  });

  it("converts m with options arg, no data-attribute", () => {
    expect(
      testTransform(`
              const MyComponent = m("div", { class: "btn"}, "text");
      `)
    ).toMatchInlineSnapshot(`
      const MyComponent = m("div", {
        class: "btn",
        "data-component": "MyComponent"
      }, "text");
    `);
  });

  it("does not overwrite m with existing data-attribute", () => {
    expect(
      testTransform(`
      const MyComponent = m("div", { "data-component": "roffe"}, "text");
        `)
    ).toMatchInlineSnapshot(`
      const MyComponent = m("div", {
        "data-component": "roffe"
      }, "text");
    `);
  });
});

describe("arrow expressions", () => {
  it("handles non-block statement arrow expressions", () => {
    expect(
      testTransform(`
      const MyComponent = () => m("div");
    `)
    ).toMatchInlineSnapshot(`
      const MyComponent = () => m("div", {
        "data-component": "MyComponent"
      });
    `);
  });

  it("handles block statement arrow expressions", () => {
    expect(
      testTransform(`
      const MyComponent = () => {
        if (true) {
          return m("div");
        } else {
          return m("span", "nope");
        }
      }
    `)
    ).toMatchInlineSnapshot(`
      const MyComponent = () => {
        if (true) {
          return m("div", {
            "data-component": "MyComponent"
          });
        } else {
          return m("span", {
            "data-component": "MyComponent"
          }, "nope");
        }
      };
    `);

    expect(
      testTransform(`
      const Comp2 = () => m('div');
      const MyComponent = () => {
          return m("div", m(Comp2));
      }
    `)
    ).toMatchInlineSnapshot(`
      const Comp2 = () => m('div', {
        "data-component": "Comp2"
      });

      const MyComponent = () => {
        return m("div", {
          "data-component": "MyComponent"
        }, m(Comp2));
      };
    `);
  });

  it("converts comp as object with view prop arrow func", () => {
    expect(
      testTransform(
        `
        const MyComponent = { view: () => m("div") }
        `
      )
    ).toMatchInlineSnapshot(`
      const MyComponent = {
        view: () => m("div", {
          "data-component": "MyComponent"
        })
      };
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
      function MyComponent() {
        const markup = null;
        return markup;
      }
    `);

    expect(
      testTransform(`
      function MyComponent() {
        const markup = m("div", {});
        return markup;
      }
    `)
    ).toMatchInlineSnapshot(`
      function MyComponent() {
        const markup = m("div", {
          "data-component": "MyComponent->markup"
        });
        return markup;
      }
    `);
  });

  it("processes nested function components", () => {
    expect(
      testTransform(`
      if (true) {
        function MyComponent() {
          return m("div");
        }
      }
    `)
    ).toMatchInlineSnapshot(`
      if (true) {
        function MyComponent() {
          return m("div", {
            "data-component": "MyComponent"
          });
        }
      }
    `);
  });

  it("converts comp as object with view prop", () => {
    expect(
      testTransform(`
          const MyComponent = { view: function () { return m("div"); } }
        `)
    ).toMatchInlineSnapshot(`
      const MyComponent = {
        view: function () {
          return m("div", {
            "data-component": "MyComponent"
          });
        }
      };
    `);
  });

  it("uses variable name when anon function", () => {
    expect(
      testTransform(`
        const MyComponent = function() {
          return m("div");
        }
      `)
    ).toMatchInlineSnapshot(`
      const MyComponent = function () {
        return m("div", {
          "data-component": "MyComponent"
        });
      };
    `);
  });

  it("finds outer function name when nested anon function", () => {
    expect(
      testTransform(`
      function of(resource) {
        return {
          view: (vnode) => {
            return m(Comp, { svg: resource, ...vnode.attrs });
          },
        };
      }
      `)
    ).toMatchInlineSnapshot(`
      function of(resource) {
        return {
          view: vnode => {
            return m(Comp, {
              svg: resource,
              ...vnode.attrs,
              "data-component": "of"
            });
          }
        };
      }
    `);
  });
});

describe("can handle class defs", () => {
  it("uses the variable name when no name exists", () => {
    expect(
      testTransform(`
        const MyComponent = class extends Roffe {
          view() {
            return m("div");
          }
        }
      `)
    ).toMatchInlineSnapshot(`
      const MyComponent = class extends Roffe {
        view() {
          return m("div", {
            "data-component": "MyComponent"
          });
        }

      };
    `);
  });
  //   it("uses the class name when exists", () => {
  //     expect(
  //       testTransform(`
  //         class Car extends Vehicle {
  //           view() {
  //             return m("div");
  //           }
  //         }
  //       `)
  //     ).toMatchInlineSnapshot(`
  //       class Car extends Vehicle {
  //         view() {
  //           return m("div", {
  //             "data-component": "Car"
  //           });
  //         }

  //       }
  //     `);
  //   });
});

describe("uses filename as fallback", () => {
  it("uses the file’s basename when it is not unknown and is not an index file", () => {
    const filename = resolve("MyComponent.js");

    expect(
      testTransform(
        `
      export default class extends m.Component {
        view() {
          return m("div");
        }
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default class extends m.Component {
        view() {
          return m("div", {
            "data-component": "MyComponent"
          });
        }

      }
    `);

    expect(
      testTransform(
        `
      export default function() {
        return m("div");
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default function () {
        return m("div", {
          "data-component": "MyComponent"
        });
      }
    `);

    expect(
      testTransform(
        `
      export default () => {
        return m("div");
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default (() => {
        return m("div", {
          "data-component": "MyComponent"
        });
      });
    `);
  });

  it("uses the file’s directory name when it is an index file", () => {
    const filename = resolve("MyComponent/index.js");

    expect(
      testTransform(
        `
      export default class extends m.Component {
        view() {
          return m("div");
        }
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default class extends m.Component {
        view() {
          return m("div", {
            "data-component": "MyComponent"
          });
        }

      }
    `);

    expect(
      testTransform(
        `
      export default function() {
        return m("div");
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default function () {
        return m("div", {
          "data-component": "MyComponent"
        });
      }
    `);

    expect(
      testTransform(
        `
      export default () => {
        return m("div");
      }
    `,
        {},
        { filename }
      )
    ).toMatchInlineSnapshot(`
      export default (() => {
        return m("div", {
          "data-component": "MyComponent"
        });
      });
    `);
  });
});

describe("malformed cases", () => {
  it("does nothing if no component", () => {
    expect(
      testTransform(
        `
      export default () => {
        return m();
      }
    `
      )
    ).toMatchInlineSnapshot(`
      export default (() => {
        return m();
      });
    `);
  });

  it("finds outer func name in nested statements", () => {
    expect(
      testTransform(
        `
        function MyFunction() {
          return {
            view: () =>
              m(
                "ul.w-full",
              ),
          };
        }
    `
      )
    ).toMatchInlineSnapshot(`
      function MyFunction() {
        return {
          view: () => m("ul.w-full", {
            "data-component": "MyFunction"
          })
        };
      }
    `);
  });

  it("can handle array components", () => {
    expect(
      testTransform(
        `
        function MyFunction() {
          return [{
            view: () =>
              m(
                "ul.w-full",
              ),
          }];
        }
    `
      )
    ).toMatchInlineSnapshot(`
      function MyFunction() {
        return [{
          view: () => m("ul.w-full", {
            "data-component": "MyFunction"
          })
        }];
      }
    `);
  });

  it("can handle expressions", () => {
    expect(
      testTransform(
        `
        function MyFunction() {
          return true && m("div");
        }
    `
      )
    ).toMatchInlineSnapshot(`
      function MyFunction() {
        return true && m("div", {
          "data-component": "MyFunction"
        });
      }
    `);
  });

  it("can handle more complex functions", () => {
    expect(
      testTransform(
        `
        const Comp2 = () => m('div', {
          "data-component": "Comp2"
        });
      
        const MyComponent = () => {
      
          const a = m("b");
      
          return m("div", {
            "data-component": "MyComponent"
          }, m(Comp2));
        };
    `
      )
    ).toMatchInlineSnapshot(`
      const Comp2 = () => m('div', {
        "data-component": "Comp2"
      });

      const MyComponent = () => {
        const a = m("b", {
          "data-component": "MyComponent->a"
        });
        return m("div", {
          "data-component": "MyComponent"
        }, m(Comp2));
      };
    `);
  });

  it("can handle 'attrs' as Identifier or MemberExpression - by loose convention", () => {
    expect(
      testTransform(
        `
        const a = m("b", vnode.attrs, vnode.children);
    `
      )
    ).toMatchInlineSnapshot(`
      const a = m("b", Object.assign({
        "data-component": "a"
      }, vnode.attrs), vnode.children);
    `);

    expect(
      testTransform(
        `
        const b = m("b", attrs, vnode.children);
    `
      )
    ).toMatchInlineSnapshot(`
      const b = m("b", Object.assign({
        "data-component": "b"
      }, attrs), vnode.children);
    `);
  });

  it("handles MemberExpression in ObjectExpression and ReturnStatement", () => {
    expect(
      testTransform(
        `
        var Wrapper = {
          view: (vnode) => {
            return m(Error, { error: vnode.attrs.error });
          },
        };
        `
      )
    ).toMatchInlineSnapshot(`
      var Wrapper = {
        view: vnode => {
          return m(Error, {
            error: vnode.attrs.error,
            "data-component": "Wrapper"
          });
        }
      };
    `);
  });

  it("can handle more complex wrapper", () => {
    expect(
      testTransform(
        `
        var Wrapper = {
          view: (vnode) => {
            var { disabled, test, someVar } = vnode.attrs;
        
            if (someVar) {
              return m(test ? Comp1 : Comp2, vnode.attrs, vnode.children);
            } else {
              return [
                disabled
                  ? m(Sad)
                  : m(
                      Happy,
                      {
                        onChange: () => {},
                      }
                    ),
                m(Error, { error: vnode.attrs.error }),
              ];
            }
          },
        };
    `
      )
    ).toMatchInlineSnapshot(`
      var Wrapper = {
        view: vnode => {
          var {
            disabled,
            test,
            someVar
          } = vnode.attrs;

          if (someVar) {
            return m(test ? Comp1 : Comp2, Object.assign({
              "data-component": "Wrapper"
            }, vnode.attrs), vnode.children);
          } else {
            return [disabled ? m(Sad, {
              "data-component": "Wrapper"
            }) : m(Happy, {
              onChange: () => {},
              "data-component": "Wrapper"
            }), m(Error, {
              error: vnode.attrs.error,
              "data-component": "Wrapper"
            })];
          }
        }
      };
    `);
  });
});
