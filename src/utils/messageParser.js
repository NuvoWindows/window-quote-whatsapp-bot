class MessageParser {
    extractDimensions(message) {
      // Look for patterns like "36x48" or "36 by 48" or "36 inches by 48 inches"
      const patterns = [
        /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*by\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*width.*?(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*height/i,
        /width\s*(?:is|:)?\s*(\d+(?:\.\d+)?).+?height\s*(?:is|:)?\s*(\d+(?:\.\d+)?)/i
      ];
      
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          return {
            width: parseFloat(match[1]),
            height: parseFloat(match[2])
          };
        }
      }
      
      return null;
    }
    
    extractWindowType(message) {
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('standard')) return 'standard';
      if (lowerMessage.includes('bay')) return 'bay';
      if (lowerMessage.includes('shaped') || lowerMessage.includes('arch')) return 'shaped';
      
      return null;
    }
    
    extractPaneCount(message) {
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('triple') || lowerMessage.includes('3 pane')) return 3;
      if (lowerMessage.includes('single') || lowerMessage.includes('1 pane')) return 1;
      
      // Default to double pane
      return 2;
    }
    
    extractOptions(message) {
      const lowerMessage = message.toLowerCase();
      
      return {
        lowE: lowerMessage.includes('low-e') || lowerMessage.includes('lowe') || lowerMessage.includes('argon'),
        grilles: lowerMessage.includes('grille') || lowerMessage.includes('grill')
      };
    }
  }
  
  module.exports = new MessageParser();