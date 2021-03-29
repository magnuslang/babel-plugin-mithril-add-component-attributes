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
