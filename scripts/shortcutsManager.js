document.addEventListener('keydown', (e) => {

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        if (e.shiftKey) {
            UndoManager.redo();
        } else {
            UndoManager.undo();
        }
        e.preventDefault();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        UndoManager.redo();
        e.preventDefault();
        return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === CONFIG.SHORTCUTS.toggleDrawingMode) {
        document.getElementById('toggleDrawingMode').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.addRectangle) {
        document.getElementById('addRectLeft').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.extractTextures) {
        document.getElementById('extractAllLeft').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.toggleImageLock) {
        document.getElementById('lockImagesLeft').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.deleteSelected) {
        const deleteBtn = document.getElementById('deleteObjLeft');
        if (deleteBtn) deleteBtn.click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.exportAtlas) {
        document.getElementById('exportRight').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.uploadImage) {
        document.getElementById('uploadLeftBtn').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.packTextures) {
        document.getElementById('autoPack').click();
        e.preventDefault();
    }

    else if (e.code === CONFIG.SHORTCUTS.autoPackLeft) {
        document.getElementById('autoPackLeft').click();
        e.preventDefault();
    }
});
