import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips, getSiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { isDesktopBypassAuth } from '@/common/auth/desktopAuthFlags';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import { useAllCronJobs } from '@renderer/pages/cron/useCronJobs';
import { useTeamCreatedRedirect } from '@renderer/pages/team/hooks/useTeamCreatedRedirect';
import {
  SiderToolbar,
  SiderSearchEntry,
  SiderScheduledEntry,
  SiderWorkTasksEntry,
  SiderMemoryEntry,
  SiderOrgKnowledgeEntry,
  SiderPriceLibraryEntry,
  SiderSuppliersEntry,
} from './SiderNav';
import { useCcbAuthorityActive } from '@/renderer/hooks/agent/useCcbModelInfo';
import { usePrecipitationSummary } from '@/renderer/hooks/usePrecipitationSummary';
import SiderFooter from './SiderFooter';
import CronJobSiderSection from './CronJobSiderSection';
import TeamSiderSection from './TeamSiderSection';
import siderStyles from './Sider.module.css';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname, search, hash } = location;

  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const { logout, status, user } = useAuth();
  const { theme, setTheme } = useThemeContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const { jobs: cronJobs } = useAllCronJobs();
  const { active: ccbAuthorityActive } = useCcbAuthorityActive();
  const precipitationSummary = usePrecipitationSummary(ccbAuthorityActive);
  const precipitationPendingCount = precipitationSummary?.pendingCount ?? 0;
  useTeamCreatedRedirect();
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPathRef = useRef('/guid');
  const isDesktop = typeof window !== 'undefined' && Boolean((window as { electronAPI?: unknown }).electronAPI);
  const bypassAuth = isDesktop && isDesktopBypassAuth();
  const showLogout = isDesktop
    ? !bypassAuth && status === 'authenticated'
    : !isDesktop && status === 'authenticated';

  const userChipLabel = useMemo(() => {
    if (!user || bypassAuth || status !== 'authenticated') {
      return null;
    }
    const roleKey = user.work_task_role === 'employee' ? 'workTasks.roleEmployee' : 'workTasks.roleManager';
    return `${user.username} (${t(roleKey)})`;
  }, [bypassAuth, status, t, user]);

  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      lastNonSettingsPathRef.current = `${pathname}${search}${hash}`;
    }
  }, [pathname, search, hash]);

  const handleNewChat = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid', { state: { resetAssistant: true } })).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleSettingsClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    if (isSettings) {
      const target = lastNonSettingsPathRef.current || '/guid';
      Promise.resolve(navigate(target)).catch((error) => {
        console.error('Navigation failed:', error);
      });
    } else {
      Promise.resolve(navigate('/settings/model')).catch((error) => {
        console.error('Navigation failed:', error);
      });
    }
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleConversationSelect = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
  };

  const handleScheduledClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/scheduled')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleWorkTasksClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/tasks')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleOrgKnowledgeClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/org-knowledge')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handlePriceLibraryClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/price-library')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleSuppliersClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/suppliers')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleMemoryClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/memory')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleQuickThemeToggle = () => {
    void setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = useCallback(async () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    try {
      await logout();
      Promise.resolve(navigate('/login', { replace: true })).catch((error) => {
        console.error('Navigation failed:', error);
      });
    } catch (error) {
      console.error('Logout failed:', error);
      return; // logout 失败时不执行后续操作
    }
    if (onSessionClick) {
      onSessionClick();
    }
  }, [closePreview, logout, navigate, onSessionClick]);

  useEffect(() => {
    if (!showLogout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLogout, showLogout]);

  const handleCronNavigate = (path: string) => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    Promise.resolve(navigate(path)).catch(console.error);
    if (onSessionClick) onSessionClick();
  };

  const tooltipEnabled = collapsed && !isMobile;
  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);

  const workspaceHistoryProps = {
    collapsed,
    tooltipEnabled,
    onSessionClick,
    batchMode: isBatchMode,
    onBatchModeChange: setIsBatchMode,
  };

  return (
    <div className='size-full flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled} />
          </Suspense>
        ) : (
          <div className='size-full flex flex-col gap-2px'>
            <SiderToolbar
              isMobile={isMobile}
              isBatchMode={isBatchMode}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onNewChat={handleNewChat}
              onToggleBatchMode={() => setIsBatchMode((prev) => !prev)}
            />
            {/* Search entry */}
            <SiderSearchEntry
              isMobile={isMobile}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onConversationSelect={handleConversationSelect}
              onSessionClick={onSessionClick}
            />
            {/* Scheduled tasks nav entry - fixed above scroll */}
            <SiderScheduledEntry
              isMobile={isMobile}
              isActive={pathname === '/scheduled'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleScheduledClick}
            />
            <SiderWorkTasksEntry
              isMobile={isMobile}
              isActive={pathname === '/tasks' || pathname.startsWith('/tasks/')}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleWorkTasksClick}
            />
            <SiderOrgKnowledgeEntry
              isMobile={isMobile}
              isActive={pathname === '/org-knowledge'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleOrgKnowledgeClick}
            />
            <SiderMemoryEntry
              isMobile={isMobile}
              isActive={pathname === '/memory' || pathname.startsWith('/memory/')}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              visible={ccbAuthorityActive}
              pendingCount={precipitationPendingCount}
              onClick={handleMemoryClick}
            />
            <SiderPriceLibraryEntry
              isMobile={isMobile}
              isActive={pathname === '/price-library'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handlePriceLibraryClick}
            />
            <SiderSuppliersEntry
              isMobile={isMobile}
              isActive={pathname === '/suppliers'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleSuppliersClick}
            />
            {/* Divider between fixed top nav and scrollable content area */}
            <div
              className={classNames(
                'shrink-0 mt-6px mb-2px h-1px bg-[var(--color-border-2)]',
                collapsed ? 'mx-6px' : 'mx-10px'
              )}
            />
            {/* Scrollable content: pinned → team/cron (slot) → projects → conversations */}
            <div className={classNames('flex-1 min-h-0 overflow-y-auto', siderStyles.scrollArea)}>
              <Suspense fallback={<div className='min-h-200px' />}>
                <WorkspaceGroupedHistory
                  {...workspaceHistoryProps}
                  afterPinnedContent={
                    <>
                      <TeamSiderSection
                        collapsed={collapsed}
                        pathname={pathname}
                        siderTooltipProps={siderTooltipProps}
                        onSessionClick={onSessionClick}
                      />
                      {!collapsed && (
                        <CronJobSiderSection jobs={cronJobs} pathname={pathname} onNavigate={handleCronNavigate} />
                      )}
                    </>
                  }
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
      {/* Footer */}
      <SiderFooter
        isMobile={isMobile}
        isSettings={isSettings}
        collapsed={collapsed}
        theme={theme}
        siderTooltipProps={siderTooltipProps}
        userChipLabel={userChipLabel}
        onSettingsClick={handleSettingsClick}
        onThemeToggle={handleQuickThemeToggle}
        showLogout={showLogout}
        onLogoutClick={handleLogout}
      />
    </div>
  );
};

export default Sider;
