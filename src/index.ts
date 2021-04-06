import { extname, basename, dirname } from "path";

import { TransformOptions, transform } from "@babel/core";
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
    name;
    return t.objectProperty(t.stringLiteral(DATA_ATTRIBUTE), t.stringLiteral(name));
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

    return fileDetails(file);
  }

  const programVisitor: Visitor = {
    VariableDeclarator: (path, state) => {
      const name = nameForComponent(path, state.file);

      const init = path.get("init") as NodePath;

      if (t.isCallExpression(init)) {
        path.traverse(functionVisitor, {
          name,
          source: path,
          ...state,
        });
        return;
      }

      path.traverse(programVisitor, { name, source: path, ...state });
      path.skip();
    },
    ArrowFunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      const isBlock = path.get("body").isBlockStatement();

      if (!isBlock) {
        path.traverse(functionVisitor, {
          name,
          source: path,
          file: state.file,
        });
      } else {
        path.traverse(returnStatementVisitor, {
          name,
          source: path,
          file: state.file,
        });
      }
    },
    FunctionExpression: (path, state) => {
      const name = nameForComponent(path, state.file, state.name);
      path.traverse(functionVisitor, { name, source: path, ...state });
    },
    FunctionDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);

      if (path.get("body").isBlockStatement()) {
        path.traverse(returnStatementVisitor, {
          name,
          source: path,
          ...state,
        });
        path.skip();
        return;
      }

      path.traverse(functionVisitor, { name, source: path, ...state });
    },
    ClassDeclaration: (path, state) => {
      const name = nameForComponent(path, state.file);
      path.traverse(returnStatementVisitor, { name, source: state.source });
    },
    ExportDefaultDeclaration: (path, state) => {
      const name = fileDetails(state.file);
      path.traverse(returnStatementVisitor, { name, source: state.source });
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
    },
  };

  const functionVisitor: Visitor<{ name: string; source: NodePath }> = {
    CallExpression: (path, { name, source }) => {
      // only add to the outermost component, not in a nested function
      if (path.parent !== source.node && !t.isVariableDeclarator(source)) {
        return;
      }

      if (!t.isIdentifier(path.node.callee, { name: "m" })) {
        return;
      }

      const { arguments: args } = path.node;

      if (args.length === 0) {
        return;
      }

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

      const hasDataAttribute = secondArgument.node.properties.find(
        (property) => t.isObjectProperty(property) && t.isStringLiteral(property.key, { value: DATA_ATTRIBUTE })
      );

      if (hasDataAttribute) {
        return;
      }

      secondArgument.node.properties.push(createObjectProperties(name));
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
        binding.path.traverse(functionVisitor, {
          ...state,
          source: binding.path,
          name: `${state.name}->${arg.node.name}`,
        });
        return;
      }

      if (arg.isObjectExpression()) {
        arg.traverse(programVisitor, { ...state, source: path });
        return;
      }

      path.traverse(functionVisitor, { ...state, source: path });
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

const test = testTransform(
  `
  import classnames from "classnames";
  import m from "mithril";
  import { Alert } from "~/components";
  import { t } from "~/Localizer";
  import { getActiveNews, markAsRead } from "~/scenes/news/News";
  import { NewsModal } from "~/scenes/news/NewsModal";
  import * as Buttons from "~/widgets/Buttons";
  
  const NewsAlert = {
    view(/** @type {m.Vnode} */ { attrs: { class: classname, news, onClose, model }, children }) {
      return [
        m(Alert, {
          class: classnames("animate-slide-in-top mt-md", classname),
          message: [
            news.subject,
            " ",
            Buttons.smallBtnPositive(t("ActiveNews.buttonReadMore"), () => model.showNewsItem(news.id)),
            " ",
            children,
          ],
          onClose: () => onClose(news),
        }),
      ];
    },
  };
  
  class Model {
    constructor() {
      this.showNews = false;
      this.newsList = [];
      this.newsItem = {};
    }
    setNews(news) {
      this.newsList = news;
    }
    showNewsItem(id) {
      this.newsItem = this.newsList.find((n) => n.id === id);
      this.showNews = true;
    }
  }
  
  export const ActiveNewsBanner = {
    oninit() {
      this.lastHiddenIds = [];
      this.showMore = false;
      this.model = new Model();
    },
    view({ attrs: { centered } }) {
      const { data: news } = getActiveNews();
      const nonHiddenNews = news.filter((news) => !this.lastHiddenIds.includes(news.id));
      this.model.setNews(nonHiddenNews);
      const canShowMore = !this.showMore && nonHiddenNews.length > 1;
      const canShowLess = this.showMore && nonHiddenNews.length > 1;
      const hasNewsToShow = nonHiddenNews.length > 0;
  
      // This eslint rule has problems with
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const hide = (news) => {
        this.lastHiddenIds.push(news.id);
      };
  
      return (
        m("div.z-notification-behind-backdrop.px-md.pb-md", [
          this.model.showNews &&
            m(NewsModal, {
              newsItem: this.model.newsItem,
              closeFn: () => {
                markAsRead(this.model.newsItem.id);
                this.model.showNews = false;
              },
            }),
          m(
            NewsAlert,
            { class: centered ? "container mx-auto" : null, news: nonHiddenNews[0], onClose: hide, model: this.model },
            canShowMore && Buttons.smallBtnDefault(t("ActiveNews.buttonShowMore"), () => (this.showMore = true)),
            canShowLess && Buttons.smallBtnDefault(t("ActiveNews.buttonShowLess"), () => (this.showMore = false))
          ),
          this.showMore &&
            nonHiddenNews.length > 1 &&
            nonHiddenNews
              .slice(1)
              .map((news) =>
                m(NewsAlert, { class: centered ? "container mx-auto" : null, model: this.model, news, onClose: hide })
              ),
        ])
      );
    },
  };
  
`
);

test;
console.log(test);
