/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Progress, Message } from '@arco-design/web-react';
import { CheckOne, Download, FolderOpen, Refresh, CloseOne, Install } from '@icon-park/react';
import { ipcBridge } from '@/common';
import AionModal from '@/renderer/components/base/AionModal';
import MarkdownView from '@/renderer/components/Markdown';
import type { UpdateDownloadProgressEvent, UpdateReleaseInfo, AutoUpdateStatus, CcbUpdateCheckResult } from '@/common/update/updateTypes';
import { useTranslation } from 'react-i18next';

type UpdateStatus = 'checking' | 'upToDate' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'success' | 'error';

type UpdateInfo = UpdateReleaseInfo;

const UpdateModal: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ percent: 0, speed: '', total: 0, transferred: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadPath, setDownloadPath] = useState('');
  const [releasePageUrl, setReleasePageUrl] = useState('');
  // Whether electron-updater auto-update is available (determined automatically, not user-controllable)
  const [autoUpdateAvailable, setAutoUpdateAvailable] = useState(false);
  const [autoUpdateInfo, setAutoUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
  const [ccbCheck, setCcbCheck] = useState<CcbUpdateCheckResult | null>(null);
  const [ccbApplying, setCcbApplying] = useState(false);
  const [aionUiUpdateAvailable, setAionUiUpdateAvailable] = useState(false);
  const internalFeedDownloadRef = useRef(false);

  const isInternalFeedUrl = (url?: string) =>
    Boolean(url && (url.includes('67.216.206.3') || url.includes('updates.yourcompany.com')));

  const resetState = () => {
    setStatus('checking');
    setUpdateInfo(null);
    setCurrentVersion('');
    setDownloadId(null);
    setProgress({ percent: 0, speed: '', total: 0, transferred: 0 });
    setErrorMsg('');
    setDownloadPath('');
    setReleasePageUrl('');
    setAutoUpdateAvailable(false);
    setAutoUpdateInfo(null);
    setCcbCheck(null);
    setCcbApplying(false);
    setAionUiUpdateAvailable(false);
    internalFeedDownloadRef.current = false;
  };

  const includePrerelease = useMemo(() => localStorage.getItem('update.includePrerelease') === 'true', [visible]);
  const hasCompatibleManualAsset = Boolean(updateInfo?.recommendedAsset);

  const openReleasePage = () => {
    if (!releasePageUrl) return;
    void ipcBridge.shell.openExternal.invoke(releasePageUrl).catch((error) => {
      console.error('Failed to open release page:', error);
    });
  };

  const checkForUpdates = async () => {
    setStatus('checking');
    try {
      const res = await ipcBridge.update.check.invoke({ includePrerelease });
      if (!res?.success) {
        throw new Error(res?.msg || t('update.checkFailed'));
      }
      setCurrentVersion(res.data?.currentVersion || '');

      const internalFeed = isInternalFeedUrl(res.data?.latest?.recommendedAsset?.url);

      let autoUpdateOk = false;
      if (!internalFeed) {
        try {
          const autoRes = await ipcBridge.autoUpdate.check.invoke({ includePrerelease });
          if (autoRes?.success && autoRes.data?.updateInfo) {
            autoUpdateOk = true;
            setAutoUpdateInfo({
              version: autoRes.data.updateInfo.version,
              releaseNotes: autoRes.data.updateInfo.releaseNotes,
            });
          } else if (autoRes?.msg) {
            console.warn('Auto-update check failed, using manual mode:', autoRes.msg);
          }
        } catch (err) {
          console.warn('Auto-update check error, using manual mode:', err);
        }
      }
      setAutoUpdateAvailable(autoUpdateOk);

      let nextCcbCheck: CcbUpdateCheckResult | null = null;
      try {
        const ccbRes = await ipcBridge.ccbUpdate.check.invoke({ channel: includePrerelease ? 'dev' : 'stable' });
        if (ccbRes?.success && ccbRes.data) {
          nextCcbCheck = ccbRes.data;
          setCcbCheck(ccbRes.data);
        }
      } catch (err) {
        console.warn('CCB update check unavailable:', err);
      }

      if (res.data?.latest) {
        setUpdateInfo(res.data.latest);
        setReleasePageUrl(res.data.latest.htmlUrl || '');
      }

      const aionHasUpdate = autoUpdateOk || Boolean(res.data?.updateAvailable && res.data.latest);
      setAionUiUpdateAvailable(aionHasUpdate);
      const ccbHasUpdate = Boolean(nextCcbCheck?.updateAvailable);

      if (aionHasUpdate || ccbHasUpdate) {
        if (res.data?.updateAvailable && res.data.latest && !res.data.latest.recommendedAsset && !autoUpdateOk) {
          setErrorMsg(t('update.noCompatibleAssetManual'));
        }
        setStatus('available');
        return;
      }

      setStatus('upToDate');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Update check failed:', err);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const applyCcbUpdate = async () => {
    if (!ccbCheck?.updateAvailable) return;
    setCcbApplying(true);
    try {
      const res = await ipcBridge.ccbUpdate.apply.invoke();
      if (!res?.success || !res.data?.success) {
        throw new Error(res?.msg || res?.data?.error || t('update.checkFailed'));
      }
      if (ccbCheck.mode === 'hot') {
        Message.success('万鼎后端已更新。请完全退出并重新打开 WanD。');
        setCcbCheck(null);
        await checkForUpdates();
      }
      // full mode: main process schedules NSIS /S and quits — no success toast
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus('error');
    } finally {
      setCcbApplying(false);
    }
  };

  const startCcbFullDownload = async () => {
    if (!ccbCheck || ccbCheck.mode !== 'full') return;
    setStatus('downloading');
    try {
      const fileName = `CCB-Wanding-${ccbCheck.latest}.exe`;
      const res = await ipcBridge.update.download.invoke({
        url: ccbCheck.fullInstaller.url,
        expected_sha256: ccbCheck.fullInstaller.sha256,
        file_name: fileName,
      });
      if (!res?.success || !res.data) {
        throw new Error(res?.msg || t('update.downloadStartFailed'));
      }
      internalFeedDownloadRef.current = true;
      setDownloadId(res.data.downloadId);
      setDownloadPath(res.data.file_path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('CCB full installer download failed:', err);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const startDownload = async () => {
    if (!updateInfo && !autoUpdateAvailable) return;
    setStatus('downloading');
    try {
      // Prefer the manual path so the URL is the CDN-rewritten asset.url.
      // Fall back to electron-updater (GitHub) only when the GitHub API manual check failed
      // but the yml-based auto-update check succeeded — a rare edge case.
      // 优先走手动路径（URL 是重写后的 CDN 地址）。仅当 GitHub API 失败但 electron-updater 检查成功时，
      // 回退到 electron-updater 的下载（走 GitHub），保证用户能升级。
      if (updateInfo?.recommendedAsset) {
        const asset = updateInfo.recommendedAsset;
        internalFeedDownloadRef.current = isInternalFeedUrl(asset.url);
        const res = await ipcBridge.update.download.invoke({
          url: asset.url,
          fallbackUrl: asset.fallbackUrl,
          file_name: asset.name,
          expected_sha256: asset.sha256,
        });
        if (!res?.success || !res.data) {
          throw new Error(res?.msg || t('update.downloadStartFailed'));
        }
        setDownloadId(res.data.downloadId);
        setDownloadPath(res.data.file_path);
        return;
      }

      if (autoUpdateAvailable) {
        const res = await ipcBridge.autoUpdate.download.invoke();
        if (!res?.success) {
          throw new Error(res?.msg || t('update.downloadStartFailed'));
        }
        return;
      }

      throw new Error(t('update.noCompatibleAssetManual'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Download failed:', err);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const quitAndInstall = async () => {
    try {
      await ipcBridge.autoUpdate.quitAndInstall.invoke();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Install failed:', err);
      Message.error(msg);
    }
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond > 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleOpenUpdateModal = () => {
    setVisible(true);
    resetState();
    void checkForUpdates();
  };

  useEffect(() => {
    const removeOpenListener = ipcBridge.update.open.on(handleOpenUpdateModal);
    window.addEventListener('aionui-open-update-modal', handleOpenUpdateModal);

    return () => {
      removeOpenListener();
      window.removeEventListener('aionui-open-update-modal', handleOpenUpdateModal);
    };
  }, []);

  // Listen for auto-update status events (e.g. from startup check)
  useEffect(() => {
    const removeListener = ipcBridge.autoUpdate.status.on((evt: AutoUpdateStatus) => {
      if (!evt) return;

      switch (evt.status) {
        case 'checking':
          break;
        case 'available':
          setAutoUpdateAvailable(true);
          setAutoUpdateInfo({
            version: evt.version || '',
            releaseNotes: evt.releaseNotes,
          });
          setStatus('available');
          setVisible(true);
          break;
        case 'not-available':
          setStatus('upToDate');
          break;
        case 'downloading':
          if (evt.progress) {
            setProgress({
              percent: Math.round(evt.progress.percent),
              speed: formatSpeed(evt.progress.bytesPerSecond),
              total: evt.progress.total,
              transferred: evt.progress.transferred,
            });
          }
          break;
        case 'downloaded':
          setStatus('downloaded');
          break;
        case 'error':
          setStatus('error');
          setErrorMsg(evt.error || t('update.downloadFailed'));
          break;
      }
    });

    return () => {
      removeListener();
    };
  }, [t]);

  useEffect(() => {
    const removeProgressListener = ipcBridge.update.downloadProgress.on((evt: UpdateDownloadProgressEvent) => {
      if (!evt) return;
      if (!downloadId || evt.downloadId !== downloadId) return;

      setProgress({
        percent: Math.round(evt.percent ?? 0),
        speed: formatSpeed(evt.bytesPerSecond ?? 0),
        total: evt.totalBytes ?? 0,
        transferred: evt.receivedBytes ?? 0,
      });

      if (evt.status === 'completed') {
        setStatus('success');
        if (evt.file_path) {
          setDownloadPath(evt.file_path);
        }
      } else if (evt.status === 'error' || evt.status === 'cancelled') {
        setStatus('error');
        setErrorMsg(evt.error || t('update.downloadFailed'));
      }
    });

    return () => {
      removeProgressListener();
    };
  }, [downloadId, t]);

  const handleClose = () => {
    setVisible(false);
  };

  const openFile = () => {
    if (!downloadPath) return;
    void ipcBridge.shell.openFile.invoke(downloadPath).catch((error) => {
      console.error('Failed to open file:', error);
    });
  };

  const showInFolder = () => {
    if (!downloadPath) return;
    void ipcBridge.shell.showItemInFolder.invoke(downloadPath).catch((error) => {
      console.error('Failed to show item in folder:', error);
    });
  };

  const renderContent = () => {
    const urlsMatch = Boolean(
      updateInfo?.recommendedAsset?.url &&
        ccbCheck?.fullInstaller?.url &&
        updateInfo.recommendedAsset.url === ccbCheck.fullInstaller.url
    );
    const bundledSameInstaller = urlsMatch && (!aionUiUpdateAvailable || ccbCheck?.mode === 'full');
    const showAionUiRow = Boolean((updateInfo?.recommendedAsset || autoUpdateAvailable) && !bundledSameInstaller);

    switch (status) {
      case 'checking':
        return (
          <div className='flex flex-col items-center justify-center py-48px'>
            <div className='w-48px h-48px mb-20px relative'>
              <div className='absolute inset-0 border-3 border-fill-3 rounded-full' />
              <div className='absolute inset-0 border-3 border-primary border-t-transparent rounded-full animate-spin' />
            </div>
            <div className='text-15px text-t-primary font-500'>{t('update.checking')}</div>
          </div>
        );

      case 'upToDate':
        return (
          <div className='flex flex-col items-center justify-center py-48px'>
            <div className='w-56px h-56px bg-[rgb(var(--success-6))]/12 rounded-full flex items-center justify-center mb-20px'>
              <CheckOne theme='filled' size='28' fill='rgb(var(--success-6))' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-8px'>{t('update.upToDateTitle')}</div>
            <div className='text-13px text-t-tertiary'>
              {t('update.currentVersion', { version: currentVersion || '-' })}
            </div>
          </div>
        );

      case 'available':
        return (
          <div className='flex flex-col h-full'>
            <div className='px-24px py-16px border-b border-border-2 bg-fill-1'>
              <div className='text-15px font-600 text-t-primary mb-12px'>{t('update.availableTitle')}</div>
              <div className='flex flex-col gap-10px'>
                {ccbCheck?.updateAvailable && (
                  <div className='flex items-center justify-between gap-12px px-12px py-10px rounded-8px bg-fill-2'>
                    <div className='text-13px text-t-primary'>
                      {bundledSameInstaller ? 'WanD 完整更新' : '万鼎后端'}{' '}
                      <span className='text-t-tertiary'>
                        {ccbCheck.installed || '-'} → {ccbCheck.latest}
                      </span>
                      {bundledSameInstaller ? (
                        <span className='text-12px text-t-tertiary ml-8px'>（含界面与 aioncore）</span>
                      ) : null}
                      {!bundledSameInstaller && ccbCheck.hotUpdate?.size ? (
                        <span className='text-12px text-t-tertiary ml-8px'>
                          (~{formatSize(ccbCheck.hotUpdate.size)})
                        </span>
                      ) : null}
                    </div>
                    <Button
                      type='primary'
                      size='small'
                      loading={ccbApplying}
                      onClick={() => void (ccbCheck.mode === 'full' ? startCcbFullDownload() : applyCcbUpdate())}
                      className='!px-16px'
                    >
                      {ccbCheck.mode === 'hot' ? '热更新' : '下载安装包'}
                    </Button>
                  </div>
                )}
                {showAionUiRow && (
                  <div className='flex items-center justify-between gap-12px px-12px py-10px rounded-8px bg-fill-2'>
                    <div className='text-13px text-t-primary'>
                      AionUI{' '}
                      <span className='text-t-tertiary'>
                        {currentVersion || '-'} → {updateInfo?.version || autoUpdateInfo?.version}
                      </span>
                    </div>
                    {!hasCompatibleManualAsset && !autoUpdateAvailable && releasePageUrl ? (
                      <Button type='primary' size='small' onClick={openReleasePage} className='!px-16px'>
                        {t('update.goToRelease')}
                      </Button>
                    ) : (
                      <Button type='primary' size='small' onClick={startDownload} className='!px-16px'>
                        {autoUpdateAvailable ? t('update.downloadAndInstall') : t('update.downloadButton')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!hasCompatibleManualAsset && !autoUpdateAvailable && !ccbCheck?.updateAvailable && releasePageUrl && (
              <div className='mx-24px mt-12px px-12px py-10px text-12px rounded-8px bg-[rgb(var(--warning-6))]/10 text-[rgb(var(--warning-6))]'>
                {t('update.noCompatibleAssetManual')}
              </div>
            )}

            <div className='flex-1 min-h-0 overflow-y-auto px-24px py-16px custom-scrollbar'>
              {updateInfo?.name && <div className='text-14px font-500 text-t-primary mb-12px'>{updateInfo.name}</div>}
              {updateInfo?.body || autoUpdateInfo?.releaseNotes ? (
                <div className='text-13px text-t-secondary leading-relaxed'>
                  <MarkdownView allowHtml>{updateInfo?.body || autoUpdateInfo?.releaseNotes || ''}</MarkdownView>
                </div>
              ) : (
                <div className='text-13px text-t-tertiary italic'>{t('update.noReleaseNotes')}</div>
              )}
            </div>
          </div>
        );

      case 'downloading':
        return (
          <div className='flex flex-col items-center justify-center py-48px px-32px'>
            <div className='w-56px h-56px bg-[rgb(var(--primary-6))]/12 rounded-full flex items-center justify-center mb-20px'>
              <Download size='24' fill='rgb(var(--primary-6))' className='animate-bounce' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-20px'>{t('update.downloadingTitle')}</div>
            <div className='w-full max-w-320px'>
              <Progress
                percent={progress.percent}
                status='normal'
                showText={false}
                strokeWidth={6}
                className='!mb-12px'
              />
              <div className='flex justify-between text-12px text-t-tertiary'>
                <span>
                  {formatSize(progress.transferred)} / {formatSize(progress.total)}
                </span>
                <span className='text-[rgb(var(--primary-6))] font-500'>{progress.speed}</span>
              </div>
            </div>
          </div>
        );

      case 'downloaded':
        return (
          <div className='flex flex-col items-center justify-center py-48px px-32px'>
            <div className='w-56px h-56px bg-[rgb(var(--success-6))]/12 rounded-full flex items-center justify-center mb-20px'>
              <CheckOne theme='filled' size='28' fill='rgb(var(--success-6))' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-8px'>{t('update.readyToInstall')}</div>
            <div className='mb-24px text-13px text-[rgb(var(--warning-6))] max-w-360px text-center'>
              {t('update.installWarning')}
            </div>
            <Button
              type='primary'
              size='small'
              onClick={quitAndInstall}
              icon={<Install size='14' />}
              className='!px-16px'
            >
              {t('update.installNow')}
            </Button>
          </div>
        );

      case 'installing':
        return (
          <div className='flex flex-col items-center justify-center py-48px px-32px'>
            <div className='w-48px h-48px mb-20px relative'>
              <div className='absolute inset-0 border-3 border-fill-3 rounded-full' />
              <div className='absolute inset-0 border-3 border-primary border-t-transparent rounded-full animate-spin' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-8px'>正在静默安装…</div>
            <div className='text-13px text-t-tertiary text-center max-w-360px'>
              WanD 将自动关闭，安装完成后请重新打开应用。
            </div>
          </div>
        );

      case 'success':
        return (
          <div className='flex flex-col items-center justify-center py-48px px-32px'>
            <div className='w-56px h-56px bg-[rgb(var(--success-6))]/12 rounded-full flex items-center justify-center mb-20px'>
              <CheckOne theme='filled' size='28' fill='rgb(var(--success-6))' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-8px'>{t('update.downloadCompleteTitle')}</div>
            <div className='text-12px text-t-tertiary mb-24px text-center max-w-360px break-all line-clamp-2'>
              {downloadPath}
            </div>
            {internalFeedDownloadRef.current ? (
              <Button
                type='primary'
                size='small'
                icon={<Install size='14' />}
                className='!px-16px'
                onClick={() => {
                  setStatus('installing');
                  void ipcBridge.update.silentInstall
                    .invoke({ installer_path: downloadPath })
                    .then((res) => {
                      if (!res?.success) throw new Error(res?.msg || 'Silent install failed');
                    })
                    .catch((err: unknown) => {
                      setErrorMsg(err instanceof Error ? err.message : String(err));
                      setStatus('error');
                    });
                }}
              >
                立即安装
              </Button>
            ) : (
              <div className='flex gap-12px'>
                <Button size='small' onClick={showInFolder} icon={<FolderOpen size='14' />} className='!px-16px'>
                  {t('update.showInFolder')}
                </Button>
                <Button type='primary' size='small' onClick={openFile} className='!px-16px'>
                  {t('update.openFile')}
                </Button>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className='flex flex-col items-center justify-center py-48px px-32px'>
            <div className='w-56px h-56px bg-[rgb(var(--danger-6))]/12 rounded-full flex items-center justify-center mb-20px'>
              <CloseOne theme='filled' size='28' fill='rgb(var(--danger-6))' />
            </div>
            <div className='text-16px text-t-primary font-600 mb-8px'>{t('update.errorTitle')}</div>
            <div className='text-13px text-t-tertiary mb-24px text-center max-w-360px'>{errorMsg}</div>
            <div className='flex gap-12px'>
              <Button size='small' onClick={checkForUpdates} icon={<Refresh size='14' />} className='!px-16px'>
                {t('common.retry')}
              </Button>
              {releasePageUrl && (
                <Button type='primary' size='small' onClick={openReleasePage} className='!px-16px'>
                  {t('update.goToRelease')}
                </Button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={handleClose}
      size={status === 'available' ? 'medium' : 'small'}
      header={{
        title: t('update.modalTitle'),
        showClose: true,
      }}
      footer={{ render: () => null }}
      contentStyle={{
        height: status === 'available' ? '420px' : 'auto',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div className='flex flex-col h-full w-full'>{renderContent()}</div>
    </AionModal>
  );
};

export default UpdateModal;
