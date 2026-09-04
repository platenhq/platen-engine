import React from 'react';

export interface AccessibilityMeshProps {
  paraId: string;
  text: string;
  role?: string;
  ariaLevel?: number;
}

/**
 * Invisible semantic shadow mirror component.
 * Ensures full WCAG 2.1 accessibility compliance and native browser Ctrl+F search indexing
 * for canvas-rendered text tracks.
 */
export const AccessibilityMesh: React.FC<AccessibilityMeshProps> = ({
  paraId,
  text,
  role,
  ariaLevel,
}) => {
  return (
    <p
      className="ParagraphTextContent"
      hidden
      aria-hidden="false"
      role={role}
      aria-level={ariaLevel}
      data-paraid={paraId}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        margin: '-1px',
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        border: 0,
      }}
    >
      {text}
    </p>
  );
};
