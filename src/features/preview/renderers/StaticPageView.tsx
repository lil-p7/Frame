import { createElement, Fragment, type ReactNode } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import type { FramePage, StyleBreakpoint } from "@/features/document/model";
import {
  buildStaticPage,
  type StaticNode,
  type StaticTreeOptions,
} from "@/features/component-registry/staticTree";
import { COMPONENT_BASE_CSS, PAGE_CLASS, pageStylesheet } from "@/features/document/stylesheet";

interface StaticPageViewProps {
  page: FramePage;
  /** Breakpoint whose declarations the preview renders (spec §16). */
  breakpoint: StyleBreakpoint;
  /** Asset resolution and link mapping for this consumer. */
  options?: StaticTreeOptions;
}

/**
 * Preview rendering (spec §22).
 *
 * Renders the shared static tree as React markup plus the generated page
 * stylesheet — the same tree and the same structured styles the exporter
 * uses, so preview and export cannot disagree about a component's markup.
 * No editor chrome is produced here: no selection outlines, no wrappers, no
 * `data-component` hooks.
 */
export function StaticPageView({ page, breakpoint, options }: StaticPageViewProps) {
  const navigate = useNavigate();
  const tree = buildStaticPage(page, options);
  return (
    <Fragment>
      <style>{`${COMPONENT_BASE_CSS}\n${pageStylesheet(page, breakpoint)}`}</style>
      <div className={PAGE_CLASS} data-testid="preview-page" data-breakpoint={breakpoint}>
        {tree.map((node) => renderStaticNode(node, navigate))}
      </div>
    </Fragment>
  );
}

/** React view of one static node, recursively. */
function renderStaticNode(node: StaticNode, navigate: NavigateFunction): ReactNode {
  const props: Record<string, unknown> = {
    key: node.nodeId,
    className: node.className,
    ...node.element.attrs,
  };

  if (node.element.voidElement === true) {
    return createElement(node.element.tag, props);
  }

  const children: ReactNode[] = [
    node.element.text ?? "",
    ...node.children.map((child) => renderStaticNode(child, navigate)),
  ];

  /*
   * Links to another page are in-app routes (they resolve to
   * `/preview/:projectId/:pageId`). They are routed explicitly instead of
   * relying on document-level link interception, so preview navigation works
   * however Frame is mounted. External URLs, anchors, and new-tab links keep
   * their native behavior.
   */
  const href = node.element.attrs?.href;
  if (
    node.element.tag === "a" &&
    typeof href === "string" &&
    href.startsWith("/") &&
    props.target === undefined
  ) {
    props.onClick = (event: { preventDefault: () => void }): void => {
      event.preventDefault();
      void navigate(href);
    };
  }

  return createElement(node.element.tag, props, ...children);
}
