import React, { useState, useEffect } from "react";
import {
  VscChromeClose,
  VscExtensions,
  VscFile,
  VscFolderOpened,
  VscNewFolder,
  VscNewFile,
  VscRepo,
  VscRepoClone,
  VscSave,
  VscSearch,
  VscSettings,
  VscSync,
  VscTerminal,
  VscCode,
  VscStarFull,
  VscScreenFull,
  VscCloudDownload,
  VscCheck,
  VscWarning,
  VscPlug,
  VscServer,
  VscPlay,
  VscSquare,
  VscGear,
  VscSymbolClass,
  VscSymbolFile,
  VscSymbolColor,
  VscSymbolMisc,
  VscGlobe
} from "react-icons/vsc";
import "./ExtensionMarketplace.css";

// Extension icon mapping
const getExtensionIcon = (icon, category) => {
  const iconMap = {
    '⚡': <VscSymbolMisc />,
    '🔍': <VscSearch />,
    '🎨': <VscSymbolColor />,
    '💡': <VscSymbolClass />,
    '🌐': <VscGlobe />
  };
  
  const categoryIcons = {
    'Formatters': <VscGear />,
    'Linters': <VscSearch />,
    'Git': <VscRepo />,
    'Themes': <VscSymbolColor />,
    'IntelliSense': <VscSymbolClass />,
    'Other': <VscPlug />
  };
  
  return iconMap[icon] || categoryIcons[category] || <VscPlug />;
};

const MARKETPLACE_EXTENSIONS = [
  {
    id: 'prettier',
    name: 'Prettier - Code formatter',
    description: 'Opinionated code formatter for consistent style',
    author: 'Prettier Team',
    version: '3.0.0',
    downloads: 25000000,
    rating: 4.8,
    category: 'Formatters',
    webCompatible: true,
    tags: ['formatter', 'code-style', 'javascript', 'typescript'],
    icon: '⚡'
  },
  {
    id: 'es-lint',
    name: 'ESLint',
    description: 'Pluggable JavaScript linter',
    author: 'ESLint Team',
    version: '8.45.0',
    downloads: 18000000,
    rating: 4.7,
    category: 'Linters',
    webCompatible: true,
    tags: ['linter', 'javascript', 'code-quality'],
    icon: '🔍'
  },
  {
    id: 'gitlens',
    name: 'GitLens — Git supercharged',
    description: 'Supercharges Git capabilities inside VS Code',
    author: 'GitLens Team',
    version: '14.0.0',
    downloads: 22000000,
    rating: 4.9,
    category: 'Git',
    webCompatible: false,
    tags: ['git', 'blame', 'history', 'repository'],
    icon: '🔍',
    note: 'Requires Node.js backend extension host'
  },
  {
    id: 'vscode-icons',
    name: 'VS Code Icons',
    description: 'Icons for Visual Studio Code',
    author: 'Roberto Huertas',
    version: '12.0.0',
    downloads: 15000000,
    rating: 4.6,
    category: 'Themes',
    webCompatible: true,
    tags: ['icons', 'theme', 'file-association'],
    icon: '🎨'
  },
  {
    id: 'intellisense',
    name: 'IntelliCode',
    description: 'AI-assisted development',
    author: 'Microsoft',
    version: '1.2.0',
    downloads: 8000000,
    rating: 4.3,
    category: 'IntelliSense',
    webCompatible: true,
    tags: ['ai', 'autocomplete', 'development'],
    icon: '💡'
  },
  {
    id: 'live-server',
    name: 'Live Server',
    description: 'Development local server with live reload',
    author: 'Ritwick Dey',
    version: '5.7.9',
    downloads: 12000000,
    rating: 4.5,
    category: 'Other',
    webCompatible: false,
    tags: ['server', 'development', 'live-reload'],
    icon: '🌐',
    note: 'Requires Node.js backend'
  }
];

const ExtensionMarketplace = ({ onInstallExtension, installedExtensions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('downloads');
  const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' or 'installed'

  const categories = ['All', 'Formatters', 'Linters', 'Git', 'Themes', 'IntelliSense', 'Other'];
  const sortOptions = ['downloads', 'rating', 'name'];

  const filteredExtensions = MARKETPLACE_EXTENSIONS.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ext.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ext.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || ext.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const sortedExtensions = [...filteredExtensions].sort((a, b) => {
    switch (sortBy) {
      case 'downloads':
        return b.downloads - a.downloads;
      case 'rating':
        return b.rating - a.rating;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const isExtensionInstalled = (extensionId) => {
    return installedExtensions.some(ext => ext.id === extensionId);
  };

  const handleInstallExtension = (extension) => {
    if (!extension.webCompatible) {
      alert(`This extension requires a Node.js backend. ${extension.note || ''}`);
      return;
    }
    
    if (isExtensionInstalled(extension.id)) {
      alert('Extension is already installed');
      return;
    }
    
    onInstallExtension?.(extension);
  };

  const formatDownloads = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    return `${(num / 1000).toFixed(0)}K`;
  };

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <div className="marketplace-title">
          <VscExtensions size={24} />
          <h2>Extension Marketplace</h2>
        </div>
        
        <div className="marketplace-tabs">
          <button 
            className={`tab-button ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            <VscCloudDownload />
            Marketplace ({MARKETPLACE_EXTENSIONS.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            <VscCheck />
            Installed ({installedExtensions.length})
          </button>
        </div>
      </div>

      {activeTab === 'marketplace' && (
        <>
          <div className="marketplace-controls">
            <div className="search-container">
              <VscSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search extensions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="filter-select"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="downloads">Most Popular</option>
                <option value="rating">Top Rated</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div className="extensions-grid">
            {sortedExtensions.map(extension => {
          const isInstalled = isExtensionInstalled(extension.id);
          
          return (
            <div key={extension.id} className="extension-card">
              <div className="extension-header">
                <div className="extension-icon-large">{getExtensionIcon(extension.icon, extension.category)}</div>
                <div className="extension-info">
                  <h3 className="extension-name">{extension.name}</h3>
                  <p className="extension-author">by {extension.author}</p>
                  <div className="extension-meta">
                    <div className="extension-stats">
                      <span className="extension-downloads">
                        <VscCloudDownload size={12} />
                        {formatDownloads(extension.downloads)}
                      </span>
                      <span className="extension-rating">
                        <VscStarFull size={12} />
                        {extension.rating}
                      </span>
                    </div>
                    <div className="extension-tags">
                      {extension.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="extension-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="extension-description">{extension.description}</p>
              
              <div className="extension-footer">
                <div className="extension-compatibility">
                  {extension.webCompatible ? (
                    <span className="compatibility-badge compatible">
                      <VscCheck size={12} />
                      Web Compatible
                    </span>
                  ) : (
                    <span className="compatibility-badge incompatible">
                      <VscWarning size={12} />
                      Requires Backend
                    </span>
                  )}
                </div>
                
                <div className="extension-actions">
                  {isInstalled ? (
                    <button className="extension-btn installed" disabled>
                      <VscCheck />
                      Installed
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleInstallExtension(extension)}
                      className="extension-btn install"
                      disabled={!extension.webCompatible}
                    >
                      {extension.webCompatible ? 'Install' : 'View Details'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
          </div>
        </>
      )}

      {activeTab === 'installed' && (
        <div className="installed-extensions">
          {installedExtensions.length === 0 ? (
            <div className="empty-installed">
              <VscExtensions size={48} />
              <h3>No extensions installed</h3>
              <p>Install extensions from the Marketplace tab to enhance your development experience.</p>
            </div>
          ) : (
            <div className="installed-grid">
              {installedExtensions.map(extension => (
                <div key={extension.id} className="extension-card installed">
                  <div className="extension-header">
                    <div className="extension-icon-large">{getExtensionIcon(extension.icon, extension.category)}</div>
                    <div className="extension-info">
                      <h3 className="extension-name">{extension.name}</h3>
                      <p className="extension-author">by {extension.author}</p>
                      <div className="extension-meta">
                        <div className="extension-stats">
                          <span className="extension-rating">
                            <VscStarFull size={12} />
                            {extension.rating || 'N/A'}
                          </span>
                          <span className="extension-version">
                            v{extension.version || '1.0.0'}
                          </span>
                        </div>
                        <div className="extension-tags">
                          {extension.tags?.slice(0, 3).map(tag => (
                            <span key={tag} className="extension-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="extension-description">{extension.description}</p>
                  
                  <div className="extension-footer">
                    <div className="extension-compatibility">
                      <span className="compatibility-badge compatible">
                        <VscCheck size={12} />
                        Installed
                      </span>
                    </div>
                    
                    <div className="extension-actions">
                      <button className="extension-btn uninstall">
                        <VscChromeClose />
                        Uninstall
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExtensionMarketplace;
