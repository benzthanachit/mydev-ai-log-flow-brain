import { useState, useEffect, useCallback } from 'react';

export function useLocalSync(documentId: string, initialValue: string = '') {
  const [content, setContent] = useState<string>(initialValue);

  // Load initial value from local storage
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(`log-flow-${documentId}`);
      if (item) {
        setContent(item);
      } else if (initialValue) {
        setContent(initialValue);
        window.localStorage.setItem(`log-flow-${documentId}`, initialValue);
      }
    } catch (error) {
      console.error('Error reading localStorage', error);
    }
  }, [documentId, initialValue]);

  // Save to local storage
  const saveContent = useCallback((value: string) => {
    try {
      setContent(value);
      window.localStorage.setItem(`log-flow-${documentId}`, value);
    } catch (error) {
      console.error('Error setting localStorage', error);
    }
  }, [documentId]);

  return { content, saveContent };
}
