// ==================== INITIALIZATION ====================

const desktopAPI = window.textureRipper;
const isElectron = () => Boolean(desktopAPI);

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(element => new bootstrap.Tooltip(element));

function updateShortcutLabels(platform) {
    const modifier = platform === 'darwin' ? 'CMD' : 'CTRL';
    document.getElementById('undo').dataset.shortcut = `${modifier}+Z`;
    document.getElementById('redo').dataset.shortcut = platform === 'darwin' ? 'CMD+SHIFT+Z' : 'CTRL+Y';
}

// Initialize panels when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    const stageLeft = LeftPanelManager.init(
        'canvasLeftContainer',
        'addRectLeft',
        'deleteObjLeft',
        'bgUploadLeft'
    );

    const stageRight = RightPanelManager.init('canvasRightContainer');
    let resizeTimer;

    function updateRightSize() {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {
            const newWidth = parseInt(rightWidth.value);
            const newHeight = parseInt(rightHeight.value);

            if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) return;

            stageRight.bgRect.width(newWidth);
            stageRight.bgRect.height(newHeight);

            if (window.rightPanel?.updateBackground) {
                window.rightPanel.updateBackground();
            }

            stageRight.draw();
        }, 100);
    }

    rightWidth.addEventListener('input', updateRightSize);
    rightHeight.addEventListener('input', updateRightSize);

    document.getElementById('autoPack').addEventListener('click', () => {
        const padding = parseInt(document.getElementById('imagesPadding').value);
        RightPanelManager.autoPackTextures(stageRight, false, undefined, padding);
    });

    document.getElementById('autoPackLeft').addEventListener('click', () => {
        if (window.leftPanel) window.leftPanel.autoPackImages();
    });

    document.getElementById('undo').addEventListener('click', () => {
        if (window.leftPanel) UndoManager.undo();
    });

    document.getElementById('redo').addEventListener('click', () => {
        if (window.leftPanel) UndoManager.redo();
    });

    async function openImages() {
        if (!isElectron()) {
            document.getElementById('bgUploadLeft').click();
            return;
        }

        try {
            const images = await desktopAPI.openImages();
            if (images.length && window.leftPanel) {
                await window.leftPanel.loadImages(images);
            }
        } catch (error) {
            console.error('Could not open images:', error);
            FeedbackManager.show('Could not open images.');
        }
    }

    document.getElementById('uploadLeftBtn').addEventListener('click', openImages);

    document.getElementById('exportRight').addEventListener('click', async () => {
        const exportWidth = parseInt(document.getElementById('rightWidth').value);
        const exportHeight = parseInt(document.getElementById('rightHeight').value);

        if (isNaN(exportWidth) || isNaN(exportHeight) || exportWidth <= 0 || exportHeight <= 0) return;

        const originalX = stageRight.x();
        const originalY = stageRight.y();
        const originalScaleX = stageRight.scaleX();
        const originalScaleY = stageRight.scaleY();
        const originalBgVisibility = stageRight.bgRect.visible();
        const imageLayer = stageRight.findOne('.imageLayer');
        if (!imageLayer) return;

        try {
            stageRight.position({ x: 0, y: 0 });
            stageRight.scale({ x: 1, y: 1 });
            stageRight.bgRect.visible(!document.getElementById('exportTransparent').checked);
            stageRight.batchDraw();

            const dataURL = stageRight.toDataURL({
                x: stageRight.bgRect.x(),
                y: stageRight.bgRect.y(),
                width: exportWidth,
                height: exportHeight,
                pixelRatio: 1,
                mimeType: 'image/png',
                quality: 1
            });

            if (isElectron()) {
                const saved = await desktopAPI.savePNG(dataURL);
                if (saved) FeedbackManager.show('Atlas exported successfully!');
            } else {
                const link = document.createElement('a');
                link.download = 'atlas.png';
                link.href = dataURL;
                link.click();
            }
        } catch (error) {
            console.error('Could not export atlas:', error);
            FeedbackManager.show('Could not export atlas.');
        } finally {
            stageRight.bgRect.visible(originalBgVisibility);
            stageRight.position({ x: originalX, y: originalY });
            stageRight.scale({ x: originalScaleX, y: originalScaleY });
            stageRight.batchDraw();
        }
    });

    document.getElementById('exportTransparent').addEventListener('change', (event) => {
        RightPanelManager.toggleTransparency(stageRight, event.target.checked);
    });

    document.getElementById('copyVersion').addEventListener('click', () => {
        const version = document.getElementById('version-text').textContent;
        navigator.clipboard.writeText(version).then(() => {
            FeedbackManager.show('Version number copied to clipboard!');
        });
    });

    document.getElementById('reportIssue').addEventListener('click', () => {
        openExternalURL('https://github.com/raycastly/texture-ripper/issues/new?template=bug_report.yml');
    });

    document.getElementById('requestFeature').addEventListener('click', () => {
        openExternalURL('https://github.com/raycastly/texture-ripper/issues/new?template=feature_request.yml');
    });

    if (isElectron()) {
        desktopAPI.on('open-images', openImages);
        desktopAPI.on('export-atlas', () => document.getElementById('exportRight').click());
        desktopAPI.on('undo', () => UndoManager.undo());
        desktopAPI.on('redo', () => UndoManager.redo());
    }
});

// ===== DESKTOP INTEGRATION =====
if (isElectron()) {
    desktopAPI.getAppInfo().then(info => {
        document.getElementById('version-text').textContent = `v${info.version}`;
        updateShortcutLabels(info.platform);

        if (info.platform === 'darwin') {
            document.getElementById('check-updates').textContent = 'Open Releases';
        }
    }).catch(error => {
        console.log('Could not get app info from Electron:', error);
        fallbackToPackageJsonVersion();
    });

    desktopAPI.on('update-status', status => {
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = status;
        statusText.style.display = 'inline';
    });

    desktopAPI.on('update-available', info => {
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = `Downloading v${info.version}…`;
        statusText.style.display = 'inline';
    });

    desktopAPI.on('update-downloaded', info => {
        const statusText = document.getElementById('update-status-text');
        const restartBtn = document.getElementById('restart-btn');

        statusText.textContent = `Update v${info.version} ready!`;
        restartBtn.style.display = 'inline-block';
        statusText.style.display = 'inline';
        restartBtn.onclick = () => desktopAPI.restartAndInstall();
    });

    desktopAPI.on('download-progress', progress => {
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = `Downloading: ${Math.round(progress.percent)}%`;
        statusText.style.display = 'inline';
    });

    desktopAPI.on('update-error', error => {
        console.log('Update error:', error);
        const statusText = document.getElementById('update-status-text');
        if (!error.includes('No published versions') && !error.includes('404')) {
            statusText.textContent = 'Update failed';
            statusText.style.display = 'inline';
            setTimeout(() => { statusText.style.display = 'none'; }, 5000);
        }
    });

    desktopAPI.on('update-not-available', () => {
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = 'You have the latest version!';
        statusText.style.display = 'inline';
        setTimeout(() => { statusText.style.display = 'none'; }, 3000);
    });

    document.getElementById('check-updates').addEventListener('click', async () => {
        const result = await desktopAPI.checkForUpdates();
        if (result.disabled) {
            const statusText = document.getElementById('update-status-text');
            statusText.textContent = 'Updates are available in packaged builds.';
            statusText.style.display = 'inline';
        }
    });
} else {
    console.log('Running in browser - disabling auto-updater');

    const checkUpdatesBtn = document.getElementById('check-updates');
    const restartBtn = document.getElementById('restart-btn');
    const statusText = document.getElementById('update-status-text');
    const downloadBtn = document.getElementById('download-desktop');

    checkUpdatesBtn.style.display = 'none';
    restartBtn.style.display = 'none';
    statusText.style.display = 'none';
    downloadBtn.style.display = 'inline-block';
    downloadBtn.onclick = () => {
        window.open('https://github.com/tugai-code/texture-ripper/releases/latest', '_blank');
    };

    updateShortcutLabels(navigator.platform.includes('Mac') ? 'darwin' : 'other');
    fallbackToPackageJsonVersion();
}

function fallbackToPackageJsonVersion() {
    fetch('./package.json')
        .then(response => response.json())
        .then(data => {
            document.getElementById('version-text').textContent = `v${data.version}`;
        })
        .catch(error => {
            console.log('Could not load version from package.json, using default');
            document.getElementById('version-text').textContent = 'v1.0.0';
        });
}

function openExternalURL(url) {
    if (isElectron()) {
        desktopAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}
