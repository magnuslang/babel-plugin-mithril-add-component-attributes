import { extname, basename, dirname } from "path";

import { TransformOptions, transform, Visitor } from "babel-core";
import { NodePath } from "babel-traverse";
import * as types from "babel-types";

const DATA_ATTRIBUTE = "data-component";

interface FileParams {
  directory: string;
  name: string;
}

interface FileOpts {
  opts?: { filename?: string };
}
interface Plugin {
  visitor: Visitor;
  name: string;
}

interface Types {
  types: typeof types;
}

const fileDetails = (file: FileOpts): FileParams | null => {
  if (!file?.opts?.filename) {
    return null;
  }
  const { filename } = file.opts;

  if (filename === "unknown" || filename == null) {
    return null;
  }
  return {
    directory: basename(dirname(filename)),
    name: basename(filename, extname(filename)),
  };
};

export default function babelPluginMithrilComponentDataAttrs({ types: t }: Types): Plugin {
  function createObjectProperties(name: string): types.ObjectProperty {
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function nameForComponent(
    path: NodePath<
      types.FunctionDeclaration | types.ArrowFunctionExpression | types.VariableDeclarator | types.FunctionExpression
    >,
    file: FileOpts
  ): string {
    const {
      parentPath,
      node: { id },
    } = path;

    if (t.isIdentifier(id)) {
      return id.name;
    }

    if (parentPath.isVariableDeclarator()) {
      const { id } = parentPath.node;
      if (t.isIdentifier(id)) return id.name;
    }

    const details = fileDetails(file);

    if (details == null) {
      return "no details";
    }

    return details.name === "index" ? details.directory : details.name;
  }

  const programVisitor: Visitor = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);

      const init = path.get("init") as NodePath;

      if (t.isBlock(init)) {
        init.traverse(blockStatementVisitor, {
          name,
          source: path,
          ...state,
        });
        return;
      }

      path.traverse(functionVisitor, { name, source: path, ...state });
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(functionVisitor, { name, source: path, ...state });
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
          ...state,
        });
      } else {
        path.traverse(functionVisitor, { name, source: path, ...state });
      }
    },
  };

  const returnStatementVisitor: Visitor<{ name: string; source: NodePath }> = {
    ReturnStatement(path, state) {
      const arg = path.get("argument");
      if (arg.isIdentifier()) {
        const binding = path.scope.getBinding(arg.node.name);
        if (binding == null) {
          return;
        }
        binding.path.traverse(functionVisitor, state);
      } else {
        path.traverse(functionVisitor, { ...state, source: path });
      }
    },
  };

  const functionVisitor: Visitor<{ name: string; source: NodePath }> = {
    CallExpression: (path, { name, source }) => {
      // only add to the outermost component, not in a nested function
      if (path.parent !== source.node) {
        return;
      }

      if (!t.isIdentifier(path.node.callee, { name: "m" })) {
        return;
      }

      const { arguments: args } = path.node;
      if (args.length === 1) {
        args.push(t.objectExpression([createObjectProperties(name)]));
        return;
      }

      const secondArgument = path.get("arguments.1") as NodePath;

      if (!secondArgument.isObjectExpression()) {
        // insert an object with props here
        args.splice(1, 0, t.objectExpression([createObjectProperties(name)]));
        return;
      }

      const hasDataAttribute = secondArgument.node.properties.some(
        (property) => t.isObjectMember(property) && t.isStringLiteral(property.key, { value: DATA_ATTRIBUTE })
      );
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
        path.traverse(functionVisitor, { name, source: path, file: state.file });
      } else {
        path.traverse(returnStatementVisitor, {
          name,
          source: path,
          file: state.file,
        });
      }
    },
  };

  const blockStatementVisitor: Visitor<{ name: string; source: NodePath }> = {
    ObjectMember: (path, state) => {
      const props = path.get("key");
      if (props.isIdentifier() && props.node.name === "view") {
        path.traverse(returnStatementVisitor, state);
      }
    },
  };

  return {
    name: "babel-plugin-mithtril-component-data-attr",
    visitor: {
      Program(path, state) {
        path.traverse(programVisitor, state);
      },
    },
  };
}

// used for test and development
export const testTransform = (code: string, pluginOptions = {}, transformOptions: TransformOptions = {}): string => {
  if (!code) {
    return "";
  }

  const result = transform(code, {
    babelrc: false,
    plugins: [babelPluginMithrilComponentDataAttrs, pluginOptions],
    parserOpts: { plugins: [] },
    ...transformOptions,
  });

  return result.code?.trim() || "";
};

const test = testTransform("const MyComponent = () => m('div');");

test;
