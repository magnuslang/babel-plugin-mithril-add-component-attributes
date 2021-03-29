"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = babelPluginMithrilComponentDataAttrs;
exports.testTransform = void 0;

var _path = require("path");

var _babelCore = require("babel-core");

const DATA_ATTRIBUTE = "data-component";

const fileDetails = ({
  opts: {
    filename
  }
}) => {
  if (filename === "unknown" || filename == null) {
    return null;
  }

  return {
    directory: (0, _path.basename)((0, _path.dirname)(filename)),
    name: (0, _path.basename)(filename, (0, _path.extname)(filename))
  };
};

function babelPluginMithrilComponentDataAttrs({
  types: t
}) {
  function createObjectProperties(name) {
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function nameForComponent(path, file) {
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

    const details = fileDetails(file);

    if (details == null) {
      return "no details";
    }

    return details.name === "index" ? details.directory : details.name;
  }

  const returnStatementVisitor = {
    ReturnStatement(path, {
      name,
      source
    }) {
      const arg = path.get("argument");

      if (arg.isIdentifier()) {
        const binding = path.scope.getBinding(arg.node.name);

        if (binding == null) {
          return;
        }

        binding.path.traverse(functionVisitor, {
          name,
          source
        });
      } else {
        path.traverse(functionVisitor, {
          name,
          source: path
        });
      }
    }

  };
  const functionVisitor = {
    CallExpression: (path, {
      name,
      source
    }) => {
      // only add to the outermost component, not in a nested function
      if (path.parent !== source.node) {
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

      const hasDataAttribute = secondArgument.node.properties.some(property => !t.isSpreadProperty(property) && t.isStringLiteral(property.key, {
        value: DATA_ATTRIBUTE
      }));

      if (hasDataAttribute) {
        // do nothing if attr already exists
        return;
      }

      secondArgument.node.properties.push(createObjectProperties(name));
    },
    ArrowFunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file);

      if (!path.get("body").isBlockStatement()) {
        path.traverse(functionVisitor, {
          name,
          source: path
        });
      } else {
        path.traverse(returnStatementVisitor, {
          name,
          source: path
        });
      }
    }
  };
  const blockStatementVisitor = {
    ObjectMember: (path, state) => {
      const props = path.get("key");

      if (props.isIdentifier() && props.node.name === "view") {
        path.traverse(returnStatementVisitor, state);
      }
    }
  };
  const programVisitor = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);
      const init = path.get("init");

      if (t.isBlock(init)) {
        init.traverse(blockStatementVisitor, {
          name,
          source: path
        });
        return;
      }

      path.traverse(functionVisitor, {
        name,
        source: path
      });
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(functionVisitor, {
        name,
        source: path
      });
    },
    FunctionDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);

      if (!process) {
        return;
      }

      if (path.get("body").isBlockStatement()) {
        path.traverse(returnStatementVisitor, {
          name,
          source: path
        });
      } else {
        path.traverse(functionVisitor, {
          name,
          source: path
        });
      }
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
  var _result$code;

  if (!code) {
    return "";
  }

  const result = (0, _babelCore.transform)(code, {
    babelrc: false,
    plugins: [babelPluginMithrilComponentDataAttrs, pluginOptions],
    parserOpts: {
      plugins: []
    },
    ...transformOptions
  });
  return ((_result$code = result.code) === null || _result$code === void 0 ? void 0 : _result$code.trim()) || "";
};

exports.testTransform = testTransform;