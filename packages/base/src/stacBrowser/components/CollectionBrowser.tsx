import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { Button } from '@/src/shared/components/Button';
import { LoadingIcon } from '@/src/shared/components/loading';
import { fetchWithProxies } from '@/src/tools';
import { ArrowLeft } from 'lucide-react';

interface ICollectionBrowserProps {
  model?: IJupyterGISModel;
  catalogUrl: string;
  onCollectionSelect: (collection: any) => void;
}

interface IStacLink {
  rel: string;
  href: string;
  title?: string;
  type?: string;
}

interface IStacNode {
  id: string;
  title?: string;
  description?: string;
  links: IStacLink[];
  type?: string; // 'Catalog' or 'Collection'
}

const CollectionBrowser = ({
  model,
  catalogUrl,
  onCollectionSelect,
}: ICollectionBrowserProps) => {
  // History stack tracks the drill-down path
  const [history, setHistory] = useState<{ url: string; title: string }[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>(catalogUrl);
  const [currentNode, setCurrentNode] = useState<IStacNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load or reset
  useEffect(() => {
    setCurrentUrl(catalogUrl);
    setHistory([]);
    setCurrentNode(null);
  }, [catalogUrl]);

  // Fetch data when currentUrl changes
  useEffect(() => {
    const fetchNode = async () => {
      if (!model || !currentUrl) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchWithProxies(currentUrl, model, async r =>
          r.json(),
        );
        setCurrentNode(data);
      } catch (err) {
        console.error('Failed to fetch STAC node:', err);
        setError('Failed to load catalog.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNode();
  }, [model, currentUrl]);

  // Check if the current node is a "Leaf Collection" (contains items)
  useEffect(() => {
    if (currentNode && isCollection(currentNode)) {
      // If we reached a collection with items, notify parent to show layers
      onCollectionSelect({ ...currentNode, url: currentUrl });
    }
  }, [currentNode, currentUrl, onCollectionSelect]);

  const isCollection = (node: IStacNode) => {
    if (node.type === 'Collection') return true;
    // Fallback: check for item links
    if (node.links.some(l => l.rel === 'item' || l.rel === 'items'))
      return true;
    return false;
  };

  const handleNavigate = (link: IStacLink) => {
    const targetUrl = new URL(link.href, currentUrl).toString();
    const title = currentNode?.title || currentNode?.id || 'Catalog';

    // Push current state to history and move forward
    setHistory(prev => [...prev, { url: currentUrl, title }]);
    setCurrentUrl(targetUrl);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentUrl(previous.url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIcon size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500 text-sm">{error}</div>;
  }

  if (!currentNode) return null;

  // Filter links for the dropdown
  const children = currentNode.links.filter(
    link =>
      link.rel === 'child' || link.rel === 'collection' || link.rel === 'data',
  );

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Header / Navigation */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-8 w-8 text-gray-500 hover:text-gray-900"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </Button>
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Current Level
          </span>
          <span
            className="text-sm font-semibold text-gray-800 truncate"
            title={currentNode.title || currentNode.id}
          >
            {currentNode.title || currentNode.id}
          </span>
        </div>
      </div>

      {/* Description */}
      {currentNode.description && (
        <div className="text-xs text-gray-600 line-clamp-3 bg-gray-50 p-2 rounded">
          {currentNode.description}
        </div>
      )}

      {/* Standard Native Select Dropdown */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">
          Navigate to Sub-collection:
        </label>

        <select
          className="w-full h-10 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          disabled={children.length === 0}
          onChange={e => {
            const index = parseInt(e.target.value, 10);
            if (!isNaN(index) && children[index]) {
              handleNavigate(children[index]);
            }
          }}
          value="" // Always reset to default so "Select..." shows
        >
          <option value="" disabled>
            {children.length > 0
              ? 'Select an option...'
              : 'No sub-collections'}
          </option>
          {children.map((link, idx) => (
            <option key={idx} value={idx}>
              {link.title || link.href.split('/').pop()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default CollectionBrowser;