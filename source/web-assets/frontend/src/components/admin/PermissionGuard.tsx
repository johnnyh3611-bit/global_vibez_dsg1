/**
 * Permission Guard Component
 * 
 * Controls access to UI elements based on user role level.
 * 
 * Role Hierarchy:
 * - Level 3: God-Mode (Founder) - Full access
 * - Level 2: Manager - Game management, user moderation
 * - Level 1: Floor Staff - Chat support, basic player help
 */

import React from 'react';

const PermissionGuard = ({ 
  requiredLevel, 
  children, 
  fallback = null 
}) => {
  // TODO: Integrate with actual auth context
  // For now, default to level 3 (full access) for development
  const userRoleLevel = 3;
  
  // If user's role isn't high enough, show fallback or nothing
  if (userRoleLevel < requiredLevel) {
    return fallback;
  }
  
  return <>{children}</>;
};

// Convenience components for specific roles
export const GodModeOnly = ({ children, fallback }) => (
  <PermissionGuard requiredLevel={3} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManagerOrAbove = ({ children, fallback }) => (
  <PermissionGuard requiredLevel={2} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const FloorStaffOrAbove = ({ children, fallback }) => (
  <PermissionGuard requiredLevel={1} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export default PermissionGuard;
