import { app, dialog, MessageBoxOptions, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import App from '../app';

export default class UpdateEvents {
    private static updateAvailable = false;

    // initialize auto update service - must be invoked only in production
    static initAutoUpdateService() {
        if (App.isDevelopmentMode()) {
            console.log('Skipping auto-updater in development mode');
            return;
        }

        console.log('Initializing auto update service...\n');

        // Configure auto-updater
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        // Set up event handlers
        UpdateEvents.setupEventHandlers();

        // Check for updates
        UpdateEvents.checkForUpdates();

        // Check for updates periodically (every 4 hours)
        setInterval(() => {
            UpdateEvents.checkForUpdates();
        }, 4 * 60 * 60 * 1000);
    }

    private static setupEventHandlers() {
        autoUpdater.on('checking-for-update', () => {
            console.log('Checking for updates...\n');
        });

        autoUpdater.on('update-available', (info: UpdateInfo) => {
            console.log(`Update available: v${info.version}\n`);
            UpdateEvents.updateAvailable = true;
        });

        autoUpdater.on('update-not-available', (info: UpdateInfo) => {
            console.log(`Current version ${app.getVersion()} is up to date\n`);
        });

        autoUpdater.on('download-progress', (progressObj) => {
            const logMessage = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s - Downloaded ${progressObj.percent.toFixed(1)}%`;
            console.log(logMessage);

            // Send progress to renderer if needed
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('update-download-progress', progressObj);
            }
        });

        autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
            console.log(`Update downloaded: v${info.version}\n`);
            UpdateEvents.showUpdateDialog(info);
        });

        autoUpdater.on('error', (err) => {
            console.error('Auto-updater error:', err.message);
        });
    }

    private static showUpdateDialog(info: UpdateInfo) {
        const dialogOpts: MessageBoxOptions = {
            type: 'info',
            buttons: ['Restart Now', 'Later'],
            title: 'Application Update',
            message: `IPTVnator v${info.version} is ready`,
            detail: 'A new version has been downloaded. Restart the application to apply the updates.',
        };

        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    }

    // Check for updates - must be invoked after initAutoUpdateService() and only in production
    static checkForUpdates() {
        if (!App.isDevelopmentMode()) {
            autoUpdater.checkForUpdates().catch((err) => {
                console.error('Failed to check for updates:', err.message);
            });
        }
    }

    // Manual update check triggered by user
    static async manualCheckForUpdates(): Promise<{ updateAvailable: boolean; version?: string }> {
        if (App.isDevelopmentMode()) {
            return { updateAvailable: false };
        }

        try {
            const result = await autoUpdater.checkForUpdates();
            if (result && result.updateInfo) {
                return {
                    updateAvailable: result.updateInfo.version !== app.getVersion(),
                    version: result.updateInfo.version,
                };
            }
            return { updateAvailable: false };
        } catch (err) {
            console.error('Manual update check failed:', err);
            return { updateAvailable: false };
        }
    }
}
