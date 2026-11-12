// ==================== LEFT PANEL MANAGEMENT ====================
const LeftPanelManager = {
    // Initialize the left panel
    init: (containerId, addBtnId, deleteBtnId, uploadId) => {
        const dirtyPolygons = new Set();

        const container = document.getElementById(containerId);
        const stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        const uiLayer = new Konva.Layer();
        const bgLayer = new Konva.Layer();
        const polygonLayer = new Konva.Layer();

        stage.add(bgLayer).add(polygonLayer).add(uiLayer);

        const bgImages = [];
        const thumbnailContainer = document.getElementById('referenceThumbnails');
        let activeImage = null;
        let selectedGroup = null;
        let imagesLocked = false; // Track lock state

        // Drawing mode state variables
        let drawingMode = false;
        let drawingModeHandlers = null;

        let linkRectsToImages = false;

        document.getElementById('linkRectsToImages').addEventListener('change', (e) => {
            linkRectsToImages = e.target.checked;
        });

        function getOverlappingGroups(konvaImg) {
            const imgBox = konvaImg.getClientRect();
            const groups = [];
            polygonLayer.find('.group').forEach(group => {
                if (group.sourceImage !== konvaImg) return;
                const groupBox = group.getClientRect();
                if (imgBox.x + imgBox.width > groupBox.x &&
                    imgBox.x < groupBox.x + groupBox.width &&
                    imgBox.y + imgBox.height > groupBox.y &&
                    imgBox.y < groupBox.y + groupBox.height) {
                    groups.push(group);
                }
            });
            return groups;
        }

        function activateImage(image) {
            if (drawingMode && activeImage !== image) setDrawingMode(false);
            if (activeImage) {
                activeImage.viewState = { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
            }

            activeImage = image;
            bgImages.forEach(img => img.visible(img === activeImage));
            polygonLayer.find('.group').forEach(group => {
                group.visible(Boolean(activeImage) && group.sourceImage === activeImage);
            });
            setSelectedPolygon(null);

            const view = activeImage?.viewState || { x: 0, y: 0, scale: 1 };
            stage.position({ x: view.x, y: view.y });
            stage.scale({ x: view.scale, y: view.scale });
            stage.batchDraw();

            bgImages.forEach(img => {
                img.thumbnailElement?.classList.toggle('active', img === activeImage);
            });
            thumbnailContainer.hidden = bgImages.length === 0;
        }

        function createThumbnail(konvaImg, name) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'reference-thumbnail';
            button.title = name || `Reference ${bgImages.length}`;
            button.setAttribute('aria-label', button.title);

            const image = document.createElement('img');
            image.src = konvaImg.image().src;
            image.alt = '';
            button.appendChild(image);
            button.addEventListener('click', () => activateImage(konvaImg));

            konvaImg.thumbnailElement = button;
            thumbnailContainer.appendChild(button);
            thumbnailContainer.hidden = false;
        }

        function removeBackgroundImage(konvaImg) {
            konvaImg.remove();
            const index = bgImages.indexOf(konvaImg);
            if (index > -1) bgImages.splice(index, 1);
            konvaImg.thumbnailElement?.remove();
            if (activeImage === konvaImg) {
                activeImage = null;
                activateImage(bgImages[0] || null);
            }
            tr.nodes([]);
            bgLayer.batchDraw();
        }

        function restoreBackgroundImage(konvaImg) {
            bgLayer.add(konvaImg);
            bgImages.push(konvaImg);
            thumbnailContainer.appendChild(konvaImg.thumbnailElement);
            activateImage(konvaImg);
        }

        function addBackgroundImage(img, name = '', activate = true) {
            const scale = Math.min(stage.width() / img.width, stage.height() / img.height);
            const konvaImg = new Konva.Image({
                x: (stage.width() - img.width * scale) / 2,
                y: (stage.height() - img.height * scale) / 2,
                image: img,
                width: img.width * scale,
                height: img.height * scale,
                draggable: !imagesLocked,
                visible: false
            });
            konvaImg.viewState = { x: 0, y: 0, scale: 1 };

            bgLayer.add(konvaImg);
            bgImages.push(konvaImg);
            createThumbnail(konvaImg, name);
            if (activate || !activeImage) activateImage(konvaImg);

            UndoManager.push({
                undo: () => removeBackgroundImage(konvaImg),
                redo: () => restoreBackgroundImage(konvaImg)
            });

            return konvaImg;
        }

        function loadImageSources(sources) {
            if (!sources.length) return Promise.resolve(0);

            UndoManager.beginBatch();
            return Promise.all(sources.map(source => new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(addBackgroundImage(img, source.name, false));
                img.onerror = () => resolve(null);
                img.src = source.dataURL;
            }))).then(results => {
                UndoManager.endBatch();
                const loaded = results.filter(Boolean);
                if (loaded.length > 0) activateImage(loaded[0]);
                FeedbackManager.show(`${loaded.length} image(s) loaded`);
                return loaded.length;
            });
        }

        // Lock/Unlock Images button
        const lockBtn = document.getElementById('lockImagesLeft');
        lockBtn.addEventListener('click', () => {
            imagesLocked = !imagesLocked;
            //lockBtn.textContent = imagesLocked ? 'Unlock Images' : 'Lock Images';
            lockBtn.classList.toggle("locked");

            // Update draggable state of all background images
            bgImages.forEach(img => {
                img.draggable(!imagesLocked);
            });

            // Also update transformer state
            if (imagesLocked && tr.nodes().length > 0) {
                const selectedImage = tr.nodes()[0];
                if (selectedImage instanceof Konva.Image) {
                    tr.nodes([]); // Deselect any selected image when locking
                }
            }

            bgLayer.batchDraw();
        });

        // Clipboard paste handler with feedback
        document.addEventListener('paste', (e) => {
            // Don't handle paste events if we're in drawing mode
            if (drawingMode) return;

            // Check if we're pasting image data
            const items = e.clipboardData.items;
            let imageFound = false;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageFound = true;
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();

                    reader.onload = (evt) => {
                        const img = new Image();
                        img.onload = () => {
                            addBackgroundImage(img);
                            FeedbackManager.show('Image pasted successfully!');
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(blob);
                    break; // Only handle the first image
                }
            }

            if (!imageFound) {
                FeedbackManager.show('No image found in clipboard');
            }
        });

        function setDrawingMode(active) {
            if (drawingMode === active) return;
            if (active && !activeImage) {
                FeedbackManager.show('Open a reference image first');
                return;
            }
            drawingMode = active;
            document.getElementById('toggleDrawingMode').classList.toggle('drawing-active', active);

            if (active) {
                drawingModeHandlers = PolygonManager.initDrawingMode(
                    stage,
                    polygonLayer,
                    () => drawingMode,
                    (newPolygon) => {
                        newPolygon.sourceImage = activeImage;
                        setSelectedPolygon(newPolygon);
                        UndoManager.push({
                            undo: () => {
                                newPolygon.remove();
                                dirtyPolygons.delete(newPolygon._id);
                                if (selectedGroup === newPolygon) selectedGroup = null;
                                polygonLayer.batchDraw();
                            },
                            redo: () => {
                                activateImage(newPolygon.sourceImage);
                                polygonLayer.add(newPolygon);
                                newPolygon.visible(true);
                                dirtyPolygons.add(newPolygon._id);
                                setSelectedPolygon(newPolygon);
                                polygonLayer.batchDraw();
                            }
                        });
                    },
                    dirtyPolygons
                );
            } else {
                cancelDrawing();
            }
        }

        document.getElementById('toggleDrawingMode').addEventListener('click', () => {
            setDrawingMode(!drawingMode);
        });

        // Cancel drawing function
        const cancelDrawing = () => {
            if (drawingModeHandlers) {
                drawingModeHandlers.clearTempElements();
                drawingModeHandlers.removeEventListeners();
                drawingModeHandlers = null;
                drawingMode = false;
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawingMode) {
                setDrawingMode(false);
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedObjects();
            }
        });

        function extractPolygon(group, showErrors = false) {
            const sourceImage = group.sourceImage || PolygonManager.getUnderlyingImages(group, stage)[0];
            if (!sourceImage) {
                if (showErrors) FeedbackManager.show('No source image under this selection.');
                return false;
            }

            const textureData = ImageProcessing.extractTexture(group, sourceImage);
            if (!textureData || !window.rightPanel) {
                if (showErrors) FeedbackManager.show('Could not create texture from this selection.');
                return false;
            }

            window.rightPanel.updateTexture(group._id, textureData);
            dirtyPolygons.delete(group._id);
            return true;
        }

        document.getElementById('extractAllLeft').addEventListener('click', () => {
            let extracted = 0;
            polygonLayer.find('.group').forEach(group => {
                if (dirtyPolygons.has(group._id) && extractPolygon(group)) extracted++;
            });
            FeedbackManager.show(`${extracted} texture(s) created`);
        });

        function showPolygonContextMenu(x, y, group) {
            document.getElementById('konva-context-menu')?.remove();

            const menu = document.createElement('div');
            menu.id = 'konva-context-menu';
            Object.assign(menu.style, {
                position: 'fixed',
                top: `${y}px`,
                left: `${x}px`,
                background: '#f9f9f9',
                border: '1px solid #888',
                borderRadius: '4px',
                padding: '0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                zIndex: 1000,
                minWidth: '150px'
            });

            const item = document.createElement('div');
            item.innerText = 'Create Texture';
            Object.assign(item.style, {
                padding: '8px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#000',
                fontFamily: 'sans-serif'
            });
            item.addEventListener('mouseenter', () => {
                item.style.background = '#0078d4';
                item.style.color = '#fff';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
                item.style.color = '#000';
            });
            item.addEventListener('click', () => {
                if (extractPolygon(group, true)) FeedbackManager.show('Texture created!');
                menu.remove();
            });

            menu.appendChild(item);
            document.body.appendChild(menu);

            const removeMenu = () => {
                menu.remove();
                window.removeEventListener('click', removeMenu);
            };
            setTimeout(() => window.addEventListener('click', removeMenu), 0);
        }

        stage.on('contextmenu', (e) => {
            let node = e.target;
            let group = null;
            while (node && node !== stage) {
                if (node instanceof Konva.Group && node.name() === 'group') {
                    group = node;
                    break;
                }
                node = node.getParent();
            }
            if (!group) return;

            e.evt.preventDefault();
            setSelectedPolygon(group);
            showPolygonContextMenu(e.evt.clientX, e.evt.clientY, group);
        });

        function loadImageFiles(files) {
            const readers = Array.from(files).map(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = event => resolve({ name: file.name, dataURL: event.target.result });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }));
            return Promise.all(readers).then(loadImageSources);
        }

        document.getElementById(uploadId).addEventListener('change', event => {
            loadImageFiles(event.target.files);
            event.target.value = '';
        });

        const dragDropHandler = DragDropManager.init(
            container,
            loadImageFiles,
            {
                showOverlay: true,
                overlayId: 'leftPanelDropOverlay'
            }
        );

        document.getElementById(addBtnId).addEventListener('click', () => {
            setDrawingMode(true);
            FeedbackManager.show('Click four points to create a selection');
        });

        // Delete button
        document.getElementById(deleteBtnId).addEventListener('click', () => {
            deleteSelectedObjects();
        });

        function setSelectedPolygon(group) {
            // Clear previous selection
            if (selectedGroup && selectedGroup !== group) {
                const prevPolygon = selectedGroup.findOne('.polygon');
                if (prevPolygon) {
                    prevPolygon.stroke(CONFIG.POLYGON.STROKE);
                    prevPolygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                }
            }

            // Clear image selection
            tr.nodes([]);

            // Set new selection
            selectedGroup = group;
            if (selectedGroup) {
                const polygon = selectedGroup.findOne('.polygon');
                if (polygon) {
                    polygon.stroke(CONFIG.POLYGON.SELECTED_STROKE);
                    polygon.strokeWidth(CONFIG.POLYGON.SELECTED_STROKE_WIDTH);
                }
            }

            polygonLayer.draw();
        }

        // Helper function for deleting selected objects (with undo)
        function deleteSelectedObjects() {
            // Case 1: polygon selected
            if (selectedGroup) {
                const groupToDelete = selectedGroup;
                const groupId = groupToDelete._id;
                let detachedTexture = null;
                if (window.rightPanel && window.rightPanel.detachTexture) {
                    detachedTexture = window.rightPanel.detachTexture(groupId);
                }
                groupToDelete.remove();
                dirtyPolygons.delete(groupId);
                selectedGroup = null;
                polygonLayer.draw();

                UndoManager.push({
                    undo: () => {
                        polygonLayer.add(groupToDelete);
                        dirtyPolygons.add(groupId);
                        if (detachedTexture && window.rightPanel) {
                            window.rightPanel.restoreTexture(groupId, detachedTexture);
                        }
                        polygonLayer.batchDraw();
                    },
                    redo: () => {
                        groupToDelete.remove();
                        dirtyPolygons.delete(groupId);
                        if (detachedTexture && window.rightPanel) {
                            window.rightPanel.detachTexture(groupId);
                        }
                        selectedGroup = null;
                        polygonLayer.batchDraw();
                    }
                });
                return;
            }

            // Case 2: background image selected with transformer
            const selectedNodes = tr.nodes();
            if (selectedNodes.length > 0) {
                const imagesToDelete = selectedNodes.filter(node => node instanceof Konva.Image);
                if (imagesToDelete.length === 0) return;

                imagesToDelete.forEach(removeBackgroundImage);
                tr.nodes([]);

                UndoManager.push({
                    undo: () => {
                        imagesToDelete.forEach(restoreBackgroundImage);
                        tr.nodes([]);
                    },
                    redo: () => {
                        imagesToDelete.forEach(removeBackgroundImage);
                        tr.nodes([]);
                    }
                });
            }
        }

        // Transformer for background images only
        const tr = new Konva.Transformer({
            keepRatio: true,
            rotateEnabled: false,
            enabledAnchors: [
                'top-left','top-right',
                'bottom-left','bottom-right'
            ]
        });
        uiLayer.add(tr);

        // Image drag undo (stage-level events) + optional linked-rect dragging
        let imgDragStartPos = null;
        let imgDragLastPos = null;
        let imgLinkedGroups = [];
        let imgLinkedGroupStartPositions = [];

        stage.on('dragstart', (e) => {
            if (!(e.target instanceof Konva.Image)) return;
            const img = e.target;
            imgDragStartPos = { x: img.x(), y: img.y() };
            imgDragLastPos = { x: img.x(), y: img.y() };
            if (linkRectsToImages) {
                imgLinkedGroups = getOverlappingGroups(img);
                imgLinkedGroupStartPositions = imgLinkedGroups.map(g => ({
                    group: g, x: g.x(), y: g.y()
                }));
            } else {
                imgLinkedGroups = [];
                imgLinkedGroupStartPositions = [];
            }
        });

        stage.on('dragmove', (e) => {
            if (!(e.target instanceof Konva.Image)) return;
            if (!linkRectsToImages || imgLinkedGroups.length === 0 || !imgDragLastPos) return;
            const img = e.target;
            const dx = img.x() - imgDragLastPos.x;
            const dy = img.y() - imgDragLastPos.y;
            imgLinkedGroups.forEach(group => {
                group.x(group.x() + dx);
                group.y(group.y() + dy);
            });
            imgDragLastPos = { x: img.x(), y: img.y() };
            polygonLayer.batchDraw();
        });

        stage.on('dragend', (e) => {
            if (!(e.target instanceof Konva.Image) || !imgDragStartPos) return;
            const img = e.target;
            const start = { ...imgDragStartPos };
            const end = { x: img.x(), y: img.y() };
            // Snapshot any linked groups so undo/redo moves them with the image
            const linkedMoves = imgLinkedGroupStartPositions.map(s => ({
                group: s.group,
                start: { x: s.x, y: s.y },
                end: { x: s.group.x(), y: s.group.y() }
            }));
            imgDragStartPos = null;
            imgDragLastPos = null;
            imgLinkedGroups = [];
            imgLinkedGroupStartPositions = [];
            if (start.x === end.x && start.y === end.y) return;
            UndoManager.push({
                undo: () => {
                    img.position(start);
                    linkedMoves.forEach(m => m.group.position(m.start));
                    tr.forceUpdate(); stage.batchDraw(); polygonLayer.batchDraw();
                },
                redo: () => {
                    img.position(end);
                    linkedMoves.forEach(m => m.group.position(m.end));
                    tr.forceUpdate(); stage.batchDraw(); polygonLayer.batchDraw();
                }
            });
        });

        // Transformer undo/redo for background images
        let trStartState = null;
        tr.on('transformstart', () => {
            const nodes = tr.nodes();
            trStartState = nodes.map(node => ({
                node, x: node.x(), y: node.y(),
                scaleX: node.scaleX(), scaleY: node.scaleY(),
                rotation: node.rotation(),
                width: node.width(), height: node.height()
            }));
        });
        tr.on('transformend', () => {
            if (!trStartState) return;
            const beforeStates = trStartState;
            const afterStates = beforeStates.map(s => ({
                node: s.node, x: s.node.x(), y: s.node.y(),
                scaleX: s.node.scaleX(), scaleY: s.node.scaleY(),
                rotation: s.node.rotation(),
                width: s.node.width(), height: s.node.height()
            }));
            trStartState = null;
            UndoManager.push({
                undo: () => {
                    beforeStates.forEach(s => {
                        s.node.position({ x: s.x, y: s.y });
                        s.node.scale({ x: s.scaleX, y: s.scaleY });
                        s.node.rotation(s.rotation);
                        s.node.size({ width: s.width, height: s.height });
                    });
                    tr.forceUpdate();
                    stage.batchDraw();
                },
                redo: () => {
                    afterStates.forEach(s => {
                        s.node.position({ x: s.x, y: s.y });
                        s.node.scale({ x: s.scaleX, y: s.scaleY });
                        s.node.rotation(s.rotation);
                        s.node.size({ width: s.width, height: s.height });
                    });
                    tr.forceUpdate();
                    stage.batchDraw();
                }
            });
        });

        // Click to select background image or polygon
        stage.on('click', (e) => {
            // Don't process clicks if we're in drawing mode
            if (drawingMode) return;

            // Reset previous selection visual for polygons
            if (selectedGroup) {
                const polygon = selectedGroup.findOne('.polygon');
                if (polygon) {
                    polygon.stroke(CONFIG.POLYGON.STROKE);
                    polygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                }
            }

            // Reset selection
            let selectedImage = null;
            selectedGroup = null;
            tr.nodes([]);

            // Check what was clicked
            const clickedNode = e.target;

            // Handle polygon selection
            if (clickedNode instanceof Konva.Group && clickedNode.name() === 'group') {
                setSelectedPolygon(clickedNode);
            }
            // Handle polygon parts (vertices, midpoints, edges, drag surface)
            else if (clickedNode.getParent() instanceof Konva.Group && clickedNode.getParent().name() === 'group') {
                setSelectedPolygon(clickedNode.getParent());
            }
            // Handle background image selection (only if not locked)
            else if (clickedNode instanceof Konva.Image && !imagesLocked) {
                selectedImage = clickedNode;
                tr.nodes([selectedImage]);
            }
            // Click on empty space: clear all selection
            else if (clickedNode === stage || clickedNode.name() === 'bgRect') {
                tr.nodes([]);
                selectedGroup = null;
            }

            bgLayer.batchDraw();
            polygonLayer.batchDraw();
        });

        // Keyboard handlers for transformer
        stage.on('keydown', (e) => {
            if (e.key === 'Shift') tr.keepRatio(true);
        });

        stage.on('keyup', (e) => {
            if (e.key === 'Shift') tr.keepRatio(false);
        });

        PanZoomManager.initPanning(stage);
        PanZoomManager.initZooming(stage);

        const resizeObserver = new ResizeObserver(() => {
            stage.size({ width: container.clientWidth, height: container.clientHeight });
            stage.batchDraw();
        });
        resizeObserver.observe(container);
        stage.referenceResizeObserver = resizeObserver;

        window.leftPanel = {
            loadImages: loadImageSources,

            autoPackImages: () => {
                if (!activeImage) return;

                const image = activeImage;
                const before = {
                    x: image.x(), y: image.y(),
                    width: image.width(), height: image.height(),
                    view: { ...image.viewState }
                };
                const original = image.image();
                const scale = Math.min(stage.width() / original.width, stage.height() / original.height);
                const after = {
                    x: (stage.width() - original.width * scale) / 2,
                    y: (stage.height() - original.height * scale) / 2,
                    width: original.width * scale,
                    height: original.height * scale,
                    view: { x: 0, y: 0, scale: 1 }
                };

                const apply = state => {
                    image.position({ x: state.x, y: state.y });
                    image.size({ width: state.width, height: state.height });
                    image.viewState = { ...state.view };
                    stage.position({ x: state.view.x, y: state.view.y });
                    stage.scale({ x: state.view.scale, y: state.view.scale });
                    tr.nodes([]);
                    stage.batchDraw();
                };

                apply(after);
                UndoManager.push({ undo: () => apply(before), redo: () => apply(after) });
                FeedbackManager.show('Reference fitted to screen');
            }
        };

        return stage;
    }
};
