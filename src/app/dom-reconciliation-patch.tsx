'use client';

/**
 * Guards against a browser crash caused by in-page translators such as Google
 * Translate (the default on mobile Chrome for non-English speakers).
 *
 * The translator replaces text nodes with its own `<font>` wrappers. When React
 * later commits an update — for example when the async Gaza status banner loads,
 * the loader toggles, or the user swaps their photo — it tries to
 * `removeChild`/`insertBefore` on nodes the translator has already moved, and
 * the browser throws:
 *
 *   NotFoundError: Failed to execute 'removeChild' on 'Node':
 *   The node to be removed is not a child of this node.
 *
 * We make these two DOM methods resilient: if the target node is not actually a
 * child of the expected parent, fall back to a safe no-op instead of throwing.
 * This is the widely used React + Google Translate workaround. See
 * facebook/react#11538.
 */

if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) {
      console.warn(
        'Skipped removeChild on a node that is not a child of this node',
        child,
        this,
      );
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn(
        'Appended instead of insertBefore a reference node that is not a child of this node',
        referenceNode,
        this,
      );
      return this.appendChild(newNode) as unknown as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

export default function DomReconciliationPatch() {
  return null;
}
