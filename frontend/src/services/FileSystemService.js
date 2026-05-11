// Modern File System Access Service
class FileSystemService {
  constructor() {
    this.supportsFileSystemAccess = 'showDirectoryPicker' in window;
    this.supportsFileHandle = 'showOpenFilePicker' in window;
  }

  // Check if browser supports modern File System Access API
  isSupported() {
    return this.supportsFileSystemAccess;
  }

  // Open folder using modern File System Access API
  async openFolder() {
    try {
      if (this.supportsFileSystemAccess) {
        // Use modern File System Access API
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });
        
        return {
          handle: dirHandle,
          name: dirHandle.name,
          path: this.getPathFromHandle(dirHandle),
          isModernAPI: true
        };
      } else {
        // Fallback to traditional method
        return await this.openFolderLegacy();
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      throw error;
    }
  }

  // Get path from directory handle (approximation)
  getPathFromHandle(dirHandle) {
    // File System Access API doesn't expose full paths for security
    // We'll use the directory name as a fallback
    return `/${dirHandle.name}`;
  }

  // Read directory contents using modern API
  async readDirectory(dirHandle, path = "") {
    const files = [];
    const folders = [];

    try {
      for await (const entry of dirHandle.values()) {
        const relativePath = path ? `${path}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          files.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: file.size,
            lastModified: file.lastModified,
            handle: entry
          });
        } else if (entry.kind === 'directory') {
          folders.push({
            name: entry.name,
            path: relativePath,
            type: 'folder',
            handle: entry,
            children: []
          });
        }
      }

      return { files, folders };
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
    }
  }

  // Read file content using modern API
  async readFile(fileHandle) {
    try {
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  // Write file content using modern API
  async writeFile(fileHandle, content) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  }

  // Create new file using modern API
  async createFile(dirHandle, fileName, content = "") {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      await this.writeFile(fileHandle, content);
      return fileHandle;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }

  // Create new directory using modern API
  async createDirectory(dirHandle, dirName) {
    try {
      const subDirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
      return subDirHandle;
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  }

  // Delete file using modern API
  async deleteFile(fileHandle) {
    try {
      await fileHandle.remove();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // Delete directory using modern API
  async deleteDirectory(dirHandle, recursive = false) {
    try {
      await dirHandle.remove({ recursive });
      return true;
    } catch (error) {
      console.error('Error deleting directory:', error);
      throw error;
    }
  }

  // Legacy folder selection for older browsers
  async openFolderLegacy() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      
      input.onchange = (e) => {
        if (e.target.files.length === 0) {
          reject(new Error('No folder selected'));
          return;
        }

        const files = Array.from(e.target.files);
        const firstFile = files[0];
        const folderPath = firstFile.webkitRelativePath.split('/')[0];
        
        resolve({
          name: folderPath,
          path: `/${folderPath}`,
          files: files,
          isModernAPI: false
        });
      };

      input.oncancel = () => {
        reject(new Error('Folder selection cancelled'));
      };

      input.click();
    });
  }

  // Legacy file reading
  async readFileLegacy(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Get file tree structure
  async getFileTree(dirHandle, maxDepth = 10, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const { files, folders } = await this.readDirectory(dirHandle);
    
    const tree = [...files];

    for (const folder of folders) {
      try {
        folder.children = await this.getFileTree(folder.handle, maxDepth, currentDepth + 1);
        tree.push(folder);
      } catch (error) {
        console.warn(`Could not read directory ${folder.name}:`, error);
        tree.push(folder);
      }
    }

    return tree;
  }

  // Watch for file changes (if supported)
  async watchDirectory(dirHandle, callback) {
    if ('watch' in dirHandle) {
      try {
        const watcher = await dirHandle.watch(callback);
        return watcher;
      } catch (error) {
        console.warn('Directory watching not supported:', error);
        return null;
      }
    }
    return null;
  }

  // Check if file exists
  async fileExists(dirHandle, fileName) {
    try {
      await dirHandle.getFileHandle(fileName);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Check if directory exists
  async directoryExists(dirHandle, dirName) {
    try {
      await dirHandle.getDirectoryHandle(dirName);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get file stats
  async getFileStats(fileHandle) {
    try {
      const file = await fileHandle.getFile();
      return {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  }

  // Search for files by pattern
  async searchFiles(dirHandle, pattern, recursive = true, maxResults = 100) {
    const results = [];
    const regex = new RegExp(pattern, 'i');

    const searchInDirectory = async (currentHandle, currentPath = "") => {
      const { files, folders } = await this.readDirectory(currentHandle);

      // Check files
      for (const file of files) {
        if (results.length >= maxResults) break;
        if (regex.test(file.name)) {
          results.push({
            ...file,
            path: currentPath ? `${currentPath}/${file.name}` : file.name
          });
        }
      }

      // Recursively search folders
      if (recursive) {
        for (const folder of folders) {
          if (results.length >= maxResults) break;
          await searchInDirectory(folder.handle, currentPath ? `${currentPath}/${folder.name}` : folder.name);
        }
      }
    };

    await searchInDirectory(dirHandle);
    return results;
  }
}

export default FileSystemService;
