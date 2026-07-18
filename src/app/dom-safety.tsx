'use client';

/**
 * Guards against a class of React crashes that surface in Sentry as:
 *   "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be
 *    removed is not a child of this node." (Sentry PPM-4)
 *
 * These fire when a browser translation feature (Google Translate, or the
 * auto-translate built into mobile Chrome / in-app browsers) or a similar
 * extension mutates the text nodes React is tracking. When React later commits
 * an update and tries to remove or reinsert one of those nodes, its parent has
 * already changed underneath it, so the raw DOM call throws and unmounts the
 * whole app.
 *
 * The mitigation — recommended in https://github.com/facebook/react/issues/11538
 * — is to make removeChild and insertBefore no-op in exactly the case that
 * would otherwise throw (the node is no longer under the expected parent),
 * which keeps the React tree alive. We only intercept the throwing case, so
 * well-formed DOM operations are unaffected.
 *
 * The patch is applied at module-evaluation time (guarded so it is a no-op
 * during server rendering, where `Node` is undefined) rather than in an effect,
 * so it is in place before React commits any updates on the client.
 */
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined') {
        console.warn(
          'Skipped removeChild for a node whose parent has changed (likely browser translation).',
          child,
        );
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined') {
        console.warn(
          'Skipped insertBefore for a reference node whose parent has changed (likely browser translation).',
          referenceNode,
        );
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

/**
 * Renders nothing. Importing/mounting this component pulls in the DOM-safety
 * patch above on the client.
 */
export default function DomSafety() {
  return null;
}
