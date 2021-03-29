"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = babelPluginMithrilComponentDataAttrs;

var _path = require("path");

const DATA_ATTRIBUTE = "data-component";

const fileDetails = file => {
  var _file$opts;

  if (!(file !== null && file !== void 0 && (_file$opts = file.opts) !== null && _file$opts !== void 0 && _file$opts.filename)) {
    return null;
  }

  const {
    filename
  } = file.opts;

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

  const programVisitor = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);
      const init = path.get("init");

      if (t.isBlock(init)) {
        init.traverse(blockStatementVisitor, {
          name,
          source: path,
          ...state
        });
        return;
      }

      path.traverse(functionVisitor, {
        name,
        source: path,
        ...state
      });
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(functionVisitor, {
        name,
        source: path,
        ...state
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
          source: path,
          ...state
        });
      } else {
        path.traverse(functionVisitor, {
          name,
          source: path,
          ...state
        });
      }
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

        binding.path.traverse(functionVisitor, state);
      } else {
        path.traverse(functionVisitor, { ...state,
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

      const hasDataAttribute = secondArgument.node.properties.some(property => t.isObjectMember(property) && t.isStringLiteral(property.key, {
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
  return {
    name: "babel-plugin-mithtril-component-data-attr",
    visitor: {
      Program(path, state) {
        path.traverse(programVisitor, state);
      }

    }
  };
}