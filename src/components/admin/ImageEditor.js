
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import ImageLibrary from './ImageLibrary';
import './ImageEditor.css';

const ImageEditor = ({ sectionId, title, showPositionControl = false, onSaveOverride }) => {
  // Determine if this section requires a fixed aspect ratio context
  const getFixedRatio = (id) => {
    if (id.includes('program')) return '16 / 9';
    if (id.includes('instructor')) return '4 / 5';
    // enforce 16:9 for welcome to match widespread design patterns and user uploaded mocks
    if (id.includes('welcome')) return '16 / 9';
    return null;
  };

  const fixedRatio = getFixedRatio(sectionId);

  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Position is stored as Percentages (0-100). Default Center (50, 50).
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState(fixedRatio || '16 / 9');

  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [postLink, setPostLink] = useState('');

  const nodeRef = React.useRef(null);
  const maskRef = React.useRef(null);
  const apiBaseUrl = '';

  useEffect(() => {
    const fetchCurrentImage = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/content/${sectionId}`);
        if (response.data && response.data.content_value) {
          try {
            const content = JSON.parse(response.data.content_value);
            setCurrentImageUrl(content.url || response.data.content_value);
            if (content.postLink) setPostLink(content.postLink);

            const parsedZoom = parseFloat(content.zoom);
            setZoom(!isNaN(parsedZoom) && parsedZoom > 0 ? parsedZoom : 1);

            if (!fixedRatio && content.aspectRatio) {
              setAspectRatio(content.aspectRatio);
            }

            // Extract Position Coords (Percentages 0-100)
            if (content.coords) {
              const { x, y } = content.coords;
              if (typeof x === 'number' && typeof y === 'number') {
                setPosition({ x, y });
              } else {
                setPosition({ x: 50, y: 50 });
              }
            } else {
              setPosition({ x: 50, y: 50 });
            }
          } catch (e) {
            setCurrentImageUrl(response.data.content_value);
            setPosition({ x: 50, y: 50 });
          }
        }
      } catch (error) {
        if (error.response && error.response.status !== 404) {
          console.error(`Error fetching content for ${sectionId}:`, error);
        }
      }
    };
    fetchCurrentImage();
  }, [sectionId, apiBaseUrl, fixedRatio]);

  const handleDrag = (e, ui) => {
    if (!maskRef.current) return;

    // Convert Pixel Drag to Percentage Change
    // Dragging Mouse DOWN (+Y) -> Image moves DOWN -> Top (0%) comes into view.
    // So +Y delta means REDUCING percentage towards 0.

    const { width, height } = maskRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const deltaXPercent = (ui.deltaX / width) * 100;
    const deltaYPercent = (ui.deltaY / height) * 100;

    setPosition(prev => ({
      x: Math.max(0, Math.min(100, prev.x - deltaXPercent)),
      y: Math.max(0, Math.min(100, prev.y - deltaYPercent))
    }));
  };

  const handleSave = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatusMessage('Saving...');
    setMessageType('');

    let imageUrl = currentImageUrl;

    try {
      if (selectedFile) {
        setStatusMessage('Uploading image...');
        const formData = new FormData();
        formData.append('image', selectedFile);
        const uploadResponse = await axios.post(`${apiBaseUrl}/api/upload`, formData);
        imageUrl = uploadResponse.data.url;
      }

      if (!imageUrl && !postLink) {
        setStatusMessage('Please select an image.');
        setIsLoading(false);
        return;
      }

      const contentToSave = {
        url: imageUrl,
        coords: position, // Save Percentage Coords
        postLink: postLink,
        zoom: zoom,
        aspectRatio: aspectRatio,
      };

      // Support custom save logic (e.g. for Syncing multiple keys)
      if (onSaveOverride) {
        await onSaveOverride(imageUrl, contentToSave);
      } else {
        // Default Save
        await axios.put(`${apiBaseUrl}/api/content/${sectionId}`, {
          content_type: 'image_details',
          content_value: JSON.stringify(contentToSave),
        });
      }

      setCurrentImageUrl(imageUrl);
      setStatusMessage('Image updated successfully!');
      setMessageType('success');
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      setStatusMessage('Error saving image.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setStatusMessage('');
  };
  const handleZoomChange = (e) => setZoom(parseFloat(e.target.value));
  const handleAspectRatioChange = (e) => setAspectRatio(e.target.value);
  const handleSelectFromLibrary = (url) => {
    setCurrentImageUrl(url);
    setIsLibraryOpen(false);
  };

  const renderToolbar = () => (
    <div className="editor-toolbar">
      <div className="editor-tools-group">
        <label className="icon-btn" title="Replace Image">
          <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
          <svg viewBox="0 0 24 24"><path d="M9 3L5 7h3v7h2V7h3L9 3zm3 18c4.42 0 8-3.58 8-8 0-1.85-.63-3.65-1.69-5.11l1.42-1.42c1.46 2.05 2.27 4.54 2.27 7.53 0 6.63-5.37 12-12 12-3.03 0-5.78-.99-8.03-2.67l1.79-1.79C6.44 20.26 8.59 21 11 21zm-9-9c0-1.92.59-3.71 1.59-5.22L2.17 5.37C.77 7.73 0 10.28 0 13c0 6.63 5.37 12 12 12 .98 0 1.94-.12 2.87-.34l-1.93-1.93C11.39 22.9 10.2 23 9 23v-2z" /></svg>
        </label>
        <button className="icon-btn" onClick={() => setIsLibraryOpen(true)}>
          <svg viewBox="0 0 24 24"><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z" /></svg>
        </button>
      </div>

      <div className="editor-tools-group">
        {fixedRatio ? (
          <div className="toolbar-info" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>
            Fixed {fixedRatio.replace(' / ', ':')}
          </div>
        ) : (
          <select value={aspectRatio} onChange={handleAspectRatioChange} className="toolbar-select">
            <option value="16 / 9">16:9 Landscape</option>
            <option value="4 / 3">4:3 Standard</option>
            <option value="1 / 1">1:1 Square</option>
            <option value="3 / 4">3:4 Portrait</option>
            <option value="9 / 16">9:16 Vertical</option>
            <option value="auto">Auto</option>
          </select>
        )}
      </div>

      <div className="editor-tools-group">
        <div className="zoom-control">
          <span style={{ fontSize: '10px', color: '#666', marginRight: 4 }}>Zoom</span>
          <input type="range" min="0.5" max="3.0" step="0.05" value={zoom} onChange={handleZoomChange} className="zoom-slider" />
        </div>
      </div>

      <div className="editor-tools-group">
        <button className="icon-btn" onClick={() => setPosition({ x: 50, y: 50 })} title="Recenter Image" style={{ display: 'flex', alignItems: 'center', gap: '5px', width: 'auto', padding: '0 10px' }}>
          <span style={{ fontSize: '12px' }}>Reset Focus</span>
        </button>
      </div>

      <div className="editor-tools-group" style={{ flexGrow: 1, justifyContent: 'flex-end', borderRight: 'none' }}>
        <button className="btn" onClick={handleSave} disabled={isLoading} style={{ padding: '6px 12px', fontSize: '14px' }}>
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div >
  );

  const PreviewStage = () => {
    // Use fixed rendering block
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', backgroundColor: '#eee', padding: '20px' }}>
        <div
          className="editor-stage-container"
          ref={maskRef}
          style={{
            width: '100%',
            maxWidth: '700px',
            aspectRatio: aspectRatio,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#ccc',
            borderRadius: '8px',
            border: '1px solid #999',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          {currentImageUrl ? (
            <>
              {/* Blurred Background Layer */}
              <img
                src={currentImageUrl}
                alt=""
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'blur(20px) brightness(0.7)',
                  transform: 'scale(1.1)', // Slight scale to avoid edge bleed
                  zIndex: 0,
                  pointerEvents: 'none'
                }}
              />

              {/* Main Image */}
              <img
                src={currentImageUrl}
                alt="Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: `${position.x}% ${position.y}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: `${position.x}% ${position.y}%`,
                  transition: 'object-position 0.1s linear',
                  pointerEvents: 'none',
                  display: 'block',
                  position: 'relative',
                  zIndex: 1
                }}
              />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Image</div>
          )}

          {/* Draggable Overlay - Infinite Pad */}
          <Draggable
            nodeRef={nodeRef}
            position={{ x: 0, y: 0 }}
            onDrag={handleDrag}
          >
            <div ref={nodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'grab', zIndex: 10 }} title="Drag to adjust focal point" />
          </Draggable>

          {/* Center Indicator */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', boxShadow: '0 0 4px rgba(0,0,0,0.5)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 11 }} />
        </div>
      </div>
    );
  };

  return (
    <div className="image-editor">
      {isLibraryOpen && (
        <ImageLibrary
          onSelect={handleSelectFromLibrary}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {renderToolbar()}

      {(sectionId.includes('instagram') || sectionId.includes('program') || sectionId.includes('link')) && (
        <div style={{ padding: '0 15px 10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
          <input
            type="text"
            placeholder="Paste destination link (optional)..."
            value={postLink}
            onChange={(e) => setPostLink(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' }}
          />
        </div>
      )}

      <h3 style={{ padding: '10px 15px', borderBottom: '1px solid #eee' }}>{title}</h3>
      <div className="image-preview draggable-container editor-stage">
        {PreviewStage()}
      </div>

      {statusMessage && <p className={`status-message ${messageType}`} style={{ padding: '0 15px 10px' }}>{statusMessage}</p>}
    </div>
  );
};

export default ImageEditor;
