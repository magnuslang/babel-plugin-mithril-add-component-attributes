import { extname, basename, dirname } from "path";

import { NodePath, Visitor } from "babel-traverse";
import * as types from "babel-types";

const DATA_ATTRIBUTE = "data-component";

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

const fileDetails = (file: FileOpts): string => {
  const fail = "unable to resolve component name and filename";

  if (!file?.opts?.filename) {
    return fail;
  }
  const { filename } = file.opts;

  if (filename === "unknown" || filename == null) {
    return fail;
  }

  const details = {
    directory: basename(dirname(filename)),
    name: basename(filename, extname(filename)),
  };
  return details.name === "index" ? details.directory : details.name;
};

export default function babelPluginMithrilComponentDataAttrs({ types: t }: Types): Plugin {
  function createObjectProperties(name: string): types.ObjectProperty {
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
  }

  function nameForAnonCallExpression(path: NodePath, file: FileOpts) {
    // try to get a named function parent
    let p = path;

    while (p) {
      p = p.getFunctionParent();
      if (t.isFunctionDeclaration(p) && p.isFunctionDeclaration() && p.node?.id?.name) {
        return p.node.id.name;
      }
    }

    // last resort: file details
    return fileDetails(file);
  }

  function nameForComponent(
    path: NodePath<
      | types.FunctionDeclaration
      | types.ArrowFunctionExpression
      | types.VariableDeclarator
      | types.FunctionExpression
      | types.ClassDeclaration
    >,
    file: FileOpts,
    passedDownName?: string
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

    if (passedDownName) {
      return passedDownName;
    }

    // last resort: file details
    return fileDetails(file);
  }

  const programVisitor: Visitor<{ name: string; source: NodePath }> = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(programVisitor, { name, source: path, ...state });
      path.skip();
    },
    ArrowFunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      const isBlock = path.get("body").isBlockStatement();

      if (!isBlock) {
        path.traverse(programVisitor, {
          name,
          source: path,
          file: state.file,
        });
      } else {
        path.traverse(programVisitor, {
          name,
          source: path,
          file: state.file,
        });
      }
      path.skip();
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      path.traverse(programVisitor, { name, source: path, ...state });
      path.skip();
    },
    FunctionDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);
      name;
      path.traverse(programVisitor, { name, source: path, ...state });
      path.skip();
    },
    ClassDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);
      name;
      path.traverse(programVisitor, { name, source: state.source });
      path.skip();
    },
    ExportDefaultDeclaration: (path, state) => {
      const name = fileDetails(state.file);
      path.traverse(programVisitor, { ...state, name, source: path });
      path.skip();
    },
    ObjectMember: (path, state) => {
      const props = path.get("key");

      if (!(props.isIdentifier() && props.node.name === "view")) {
        path.skip();
        return;
      }

      path.traverse(programVisitor, state);
      path.skip();
    },
    CallExpression: (path, state) => {
      if (!t.isIdentifier(path.node.callee, { name: "m" })) {
        return;
      }
      const isVar = t.isVariableDeclarator(path.parentPath.node);
      if (isVar) {
        const pp = path.parentPath as NodePath<types.VariableDeclarator>;

        const isIdent = t.isIdentifier(pp.node.id);

        if (isIdent) {
          const id = pp.node.id as types.Identifier;

          if (state.name !== id.name) {
            addAttribute(path, {
              ...state,
              source: path,
              name: `${state.name}->${id.name}`,
            });
            path.skip();
            return;
          }
        }
      }

      addAttribute(path, {
        ...state,
        source: path,
        name: state.name || nameForAnonCallExpression(path, state.file),
      });
      path.skip();
    },
  };

  const mithrilAttrVisitor: Visitor<{ name: string; source: NodePath }> = {
    ObjectExpression: (path, { name }) => {
      // insert into object
      const hasDataAttribute = path.node.properties.find(
        (property) => t.isObjectProperty(property) && t.isStringLiteral(property.key, { value: DATA_ATTRIBUTE })
      );

      if (hasDataAttribute) {
        path.stop();
        return;
      }

      path.node.properties.push(createObjectProperties(name));
      path.stop();
    },
    Identifier: (path, state) => {
      if (!state.target) {
        return;
      }

      path;
      // this is so you can use 'attrs' convention when Identifier is unknown at compile-time
      if (path.node.name === "attrs") {
        state.target.replaceWith(
          merge(t.objectExpression([createObjectProperties(state.name)]), state.memeberParent || path.node)
        );
      }

      path.skip();
    },
    MemberExpression: (path, state) => {
      if (!state.target) {
        path.skip();
        return;
      }

      // this is so you can use 'attrs' convention when Identifier is unknown at compile-time
      if (t.isIdentifier(path.node.property) && path.node.property.name === "attrs") {
        state.target.replaceWith(merge(t.objectExpression([createObjectProperties(state.name)]), path.node));
      }

      path.stop();
    },
    CallExpression: (path, state) => {
      if (!state.target) {
        return;
      }

      // convention: assume 'getAttrs' func returns attrs
      if (t.isIdentifier(path.node.callee) && path.node.callee.name === "getAttrs") {
        state.target.replaceWith(merge(t.objectExpression([createObjectProperties(state.name)]), path.node));
      } else {
        state.target.parentPath.node.arguments.splice(1, 0, t.objectExpression([createObjectProperties(state.name)]));
      }

      path.stop();
    },
  };

  const addAttribute = (path: NodePath<types.CallExpression>, state: { name: string; source: NodePath }) => {
    const { name } = state;
    const { arguments: args } = path.node;
    if (args.length === 0) {
      return;
    }

    if (!name) {
      return;
    }

    if (args.length === 1) {
      args.push(t.objectExpression([createObjectProperties(name)]));
      return;
    }
    const targetPath = path.get("arguments.1");
    const target = path.node.arguments[1];

    target;
    if (
      t.isObjectExpression(target) ||
      t.isMemberExpression(target) ||
      t.isIdentifier(target) ||
      t.isCallExpression(target)
    ) {
      path.traverse(mithrilAttrVisitor, { target: targetPath, ...state });
      return;
    }

    // inject new attrs if we dont find any possible existing
    path.node.arguments.splice(1, 0, t.objectExpression([createObjectProperties(name)]));
  };

  const merge = (
    obj: types.ObjectExpression,
    expr: types.Identifier | types.MemberExpression | types.CallExpression
  ) => {
    return t.expressionStatement(
      t.callExpression(t.memberExpression(t.identifier("Object"), t.identifier("assign")), [obj, expr])
    );
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
