// VS Code Marketplace API Service
class MarketplaceService {
  constructor() {
    this.publicGalleryUrl = "https://marketplace.visualstudio.com/_apis/public/gallery";
    this.openVSXUrl = "https://open-vsx.org/api";
    this.useOpenVSX = false; // Toggle between public gallery and Open VSX
  }

  // Toggle between Microsoft Marketplace and Open VSX Registry
  setMarketplace(useOpenVSX = false) {
    this.useOpenVSX = useOpenVSX;
  }

  // Search extensions from VS Code Marketplace
  async searchExtensions(query = "", pageSize = 20, pageNumber = 1) {
    try {
      if (this.useOpenVSX) {
        return await this.searchOpenVSX(query, pageSize, pageNumber);
      } else {
        return await this.searchMicrosoftMarketplace(query, pageSize, pageNumber);
      }
    } catch (error) {
      console.error("Error searching extensions:", error);
      return { extensions: [], totalCount: 0 };
    }
  }

  // Microsoft Marketplace API
  async searchMicrosoftMarketplace(query, pageSize, pageNumber) {
    const url = `${this.publicGalleryUrl}/extensionquery`;
    
    const requestBody = {
      filters: [
        {
          criteria: [
            { filterType: 1, value: query },
            { filterType: 12, value: "4096" } // Target: Microsoft.VisualStudio.Code
          ],
          pageNumber: pageNumber,
          pageSize: pageSize,
          sortBy: 4, // Sort by installation count
          sortOrder: 0 // Descending
        }
      ],
      assetTypes: [],
      flags: 0x91
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=3.0-preview.1'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      extensions: data.results[0].extensions.map(this.transformMicrosoftExtension),
      totalCount: data.results[0].resultMetadata[0].metadataTotalCount
    };
  }

  // Open VSX Registry API
  async searchOpenVSX(query, pageSize, pageNumber) {
    const url = `${this.openVSXUrl}/search`;
    const params = new URLSearchParams({
      query: query,
      size: pageSize,
      offset: (pageNumber - 1) * pageSize
    });

    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      extensions: data.extensions.map(this.transformOpenVSXExtension),
      totalCount: data.totalSize || data.extensions.length
    };
  }

  // Get extension details by ID
  async getExtensionDetails(extensionId) {
    try {
      if (this.useOpenVSX) {
        return await this.getOpenVSXExtensionDetails(extensionId);
      } else {
        return await this.getMicrosoftExtensionDetails(extensionId);
      }
    } catch (error) {
      console.error("Error getting extension details:", error);
      return null;
    }
  }

  async getMicrosoftExtensionDetails(extensionId) {
    const [publisher, name] = extensionId.split('.');
    const url = `${this.publicGalleryUrl}/extensionquery`;
    
    const requestBody = {
      filters: [
        {
          criteria: [
            { filterType: 7, value: extensionId }
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0
        }
      ],
      assetTypes: [],
      flags: 0x91
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=3.0-preview.1'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const extension = data.results[0].extensions[0];
    
    return this.transformMicrosoftExtension(extension);
  }

  async getOpenVSXExtensionDetails(extensionId) {
    const [publisher, name] = extensionId.split('.');
    const url = `${this.openVSXUrl}/${publisher}/${name}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return this.transformOpenVSXExtension(data);
  }

  // Transform Microsoft Marketplace extension to our format
  transformMicrosoftExtension(extension) {
    return {
      id: `${extension.publisher.publisherName}.${extension.extensionName}`,
      name: extension.displayName || extension.extensionName,
      description: extension.shortDescription || "",
      author: extension.publisher.displayName || extension.publisher.publisherName,
      version: extension.versions[0]?.version || "1.0.0",
      downloads: extension.statistics?.find(stat => stat.statisticName === "install")?.value || 0,
      rating: extension.statistics?.find(stat => stat.statisticName === "averagerating")?.value || 0,
      ratingCount: extension.statistics?.find(stat => stat.statisticName === "ratingcount")?.value || 0,
      category: this.getCategoryFromTags(extension.tags),
      tags: extension.tags || [],
      icon: extension.versions[0]?.files?.find(file => file.assetType === "Microsoft.VisualStudio.Services.Icons.Default")?.source,
      webCompatible: this.isWebCompatible(extension.tags),
      marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${extension.publisher.publisherName}.${extension.extensionName}`,
      downloadUrl: extension.versions[0]?.files?.find(file => file.assetType === "Microsoft.VisualStudio.Services.VSIXPackage")?.source,
      lastUpdated: extension.lastUpdated
    };
  }

  // Transform Open VSX extension to our format
  transformOpenVSXExtension(extension) {
    return {
      id: `${extension.namespace}.${extension.name}`,
      name: extension.displayName || extension.name,
      description: extension.description || "",
      author: extension.namespace,
      version: extension.version || "1.0.0",
      downloads: extension.downloadCount || 0,
      rating: extension.averageRating || 0,
      ratingCount: extension.downloadCount || 0,
      category: this.getCategoryFromTags(extension.tags),
      tags: extension.tags || [],
      icon: extension.files?.find(file => file.type === "icon")?.url,
      webCompatible: this.isWebCompatible(extension.tags),
      marketplaceUrl: `https://open-vsx.org/extension/${extension.namespace}/${extension.name}`,
      downloadUrl: extension.files?.find(file => file.type === "vsix")?.url,
      lastUpdated: extension.timestamp
    };
  }

  // Helper methods
  getCategoryFromTags(tags) {
    if (!tags) return "Other";
    
    const tagCategories = {
      "snippet": "Snippets",
      "theme": "Themes", 
      "language-pack": "Language Packs",
      "debugger": "Debuggers",
      "linters": "Linters",
      "formatters": "Formatters",
      "git": "Git",
      "docker": "Docker",
      "remote": "Remote Development",
      "scm": "Source Control",
      "terminal": "Terminal",
      "keybindings": "Keybindings",
      "python": "Python",
      "javascript": "JavaScript",
      "typescript": "TypeScript",
      "java": "Java",
      "csharp": "C#",
      "cpp": "C++",
      "go": "Go",
      "rust": "Rust",
      "php": "PHP",
      "html": "HTML",
      "css": "CSS",
      "json": "JSON",
      "yaml": "YAML",
      "markdown": "Markdown",
      "sql": "SQL"
    };

    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      if (tagCategories[lowerTag]) {
        return tagCategories[lowerTag];
      }
    }
    
    return "Other";
  }

  isWebCompatible(tags) {
    if (!tags) return false;
    
    const webCompatibleTags = ["web", "browser", "vscode-web", "web-extension"];
    const incompatibleTags = ["native", "node", "electron", "desktop"];
    
    const hasCompatibleTag = tags.some(tag => 
      webCompatibleTags.includes(tag.toLowerCase())
    );
    
    const hasIncompatibleTag = tags.some(tag => 
      incompatibleTags.includes(tag.toLowerCase())
    );
    
    return hasCompatibleTag && !hasIncompatibleTag;
  }

  // Get popular extensions
  async getPopularExtensions(pageSize = 20, pageNumber = 1) {
    return await this.searchExtensions("", pageSize, pageNumber);
  }

  // Get extensions by category
  async getExtensionsByCategory(category, pageSize = 20, pageNumber = 1) {
    return await this.searchExtensions(category, pageSize, pageNumber);
  }
}

export default MarketplaceService;
