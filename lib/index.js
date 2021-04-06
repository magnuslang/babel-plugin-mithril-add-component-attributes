"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = babelPluginMithrilComponentDataAttrs;
exports.testTransform = void 0;

var _path = require("path");

var _core = require("@babel/core");

const DATA_ATTRIBUTE = "data-component";

const fileDetails = file => {
  var _file$opts;

  const fail = "unable to resolve component name and filename";

  if (!(file !== null && file !== void 0 && (_file$opts = file.opts) !== null && _file$opts !== void 0 && _file$opts.filename)) {
    return fail;
  }

  const {
    filename
  } = file.opts;

  if (filename === "unknown" || filename == null) {
    return fail;
  }

  const details = {
    directory: (0, _path.basename)((0, _path.dirname)(filename)),
    name: (0, _path.basename)(filename, (0, _path.extname)(filename))
  };
  return details.name === "index" ? details.directory : details.name;
};

function babelPluginMithrilComponentDataAttrs({
  types: t
}) {
  function createObjectProperties(name) {
    name;
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function nameForComponent(path, file, passedDownName) {
    const {
      parentPath,
      node: {
        id
      }
    } = path;

    if (t.isIdentifier(id)) {
      return id.name;
    }

    if (parentPath.isVariableDeclarator()) {
      const {
        id
      } = parentPath.node;
      if (t.isIdentifier(id)) return id.name;
    }

    if (passedDownName) {
      return passedDownName;
    }

    return fileDetails(file);
  }

  const programVisitor = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);
      const init = path.get("init");

      if (t.isCallExpression(init)) {
        path.traverse(functionVisitor, {
          name,
          source: path,
          ...state
        });
        return;
      }

      path.traverse(programVisitor, {
        name,
        source: path,
        ...state
      });
      path.skip();
    },
    ArrowFunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      const isBlock = path.get("body").isBlockStatement();

      if (!isBlock) {
        path.traverse(functionVisitor, {
          name,
          source: path,
          file: state.file
        });
      } else {
        path.traverse(returnStatementVisitor, {
          name,
          source: path,
          file: state.file
        });
      }
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      path.traverse(functionVisitor, {
        name,
        source: path,
        ...state
      });
    },
    FunctionDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);

      if (path.get("body").isBlockStatement()) {
        path.traverse(returnStatementVisitor, {
          name,
          source: path,
          ...state
        });
        path.skip();
        return;
      }

      path.traverse(functionVisitor, {
        name,
        source: path,
        ...state
      });
    },
    ClassDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(returnStatementVisitor, {
        name,
        source: state.source
      });
    },
    ExportDefaultDeclaration: (path, state) => {
      const name = fileDetails(state.file);
      path.traverse(returnStatementVisitor, {
        name,
        source: state.source
      });
    },
    ObjectMember: (path, state) => {
      const props = path.get("key");
      const value = path.get("value");

      if (!(props.isIdentifier() && props.node.name === "view")) {
        return;
      }

      if (value.isCallExpression()) {
        path.traverse(functionVisitor, state);
      }

      path.traverse(programVisitor, state);
      path.skip();
    }
  };
  const functionVisitor = {
    CallExpression: (path, {
      name,
      source
    }) => {
      // only add to the outermost component, not in a nested function
      if (path.parent !== source.node && !t.isVariableDeclarator(source)) {
        return;
      }

      if (!t.isIdentifier(path.node.callee, {
        name: "m"
      })) {
        return;
      }

      const {
        arguments: args
      } = path.node;

      if (args.length === 0) {
        return;
      }

      if (args.length === 1) {
        args.push(t.objectExpression([createObjectProperties(name)]));
        return;
      }

      const secondArgument = path.get("arguments.1");

      if (!secondArgument.isObjectExpression()) {
        // insert an object with props here
        args.splice(1, 0, t.objectExpression([createObjectProperties(name)]));
        return;
      }

      const hasDataAttribute = secondArgument.node.properties.find(property => t.isObjectProperty(property) && t.isStringLiteral(property.key, {
        value: DATA_ATTRIBUTE
      }));

      if (hasDataAttribute) {
        return;
      }

      secondArgument.node.properties.push(createObjectProperties(name));
    }
  };
  const returnStatementVisitor = {
    ReturnStatement(path, state) {
      const arg = path.get("argument");

      if (arg.isIdentifier()) {
        const binding = path.scope.getBinding(arg.node.name);

        if (binding == null) {
          return;
        }

        binding.path.traverse(functionVisitor, { ...state,
          source: binding.path,
          name: `${state.name}->${arg.node.name}`
        });
        return;
      }

      if (arg.isObjectExpression()) {
        arg.traverse(programVisitor, { ...state,
          source: path
        });
        return;
      }

      path.traverse(functionVisitor, { ...state,
        source: path
      });
    }

  };
  return {
    name: "babel-plugin-mithtril-component-data-attr",
    visitor: {
      Program(path, state) {
        path.traverse(programVisitor, state);
      }

    }
  };
} // used for test and development


const testTransform = (code, pluginOptions = {}, transformOptions = {}) => {
  if (!code) {
    return "";
  }

  const result = (0, _core.transform)(code, {
    plugins: [babelPluginMithrilComponentDataAttrs, pluginOptions],
    babelrc: false,
    ...transformOptions
  });
  return (result === null || result === void 0 ? void 0 : result.code) || "";
};

exports.testTransform = testTransform;
const test = testTransform(`
  function MyComponent() {
    const markup = m("div", {});
    return markup;
  }
`);
test;