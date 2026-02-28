// Configuration
const API_URL = 'http://localhost:5001';
let currentChatId = null;
let isProcessing = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    autoResizeTextarea();
});

// New Chat
function newChat() {
    currentChatId = Date.now().toString();
    document.getElementById('messages').innerHTML = '';
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('messageInput').value = '';
    document.getElementById('messageInput').focus();
}

// Make newChat available globally
window.newChat = newChat;
window.sendMessage = sendMessage;

// Send Message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || isProcessing) return;
    
    isProcessing = true;
    
    // Hide welcome screen
    document.getElementById('welcomeScreen').style.display = 'none';
    
    // Add user message
    addMessage('user', message);
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    
    // Add thinking message
    const thinkingId = addThinkingMessage();
    
    try {
        // Check if this is a product search query
        const isProductQuery = detectProductQuery(message);
        
        if (isProductQuery) {
            // Handle as product search
            await handleProductSearch(message, thinkingId);
        } else {
            // Regular chat API call with extended timeout for Mistral
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds for Mistral processing
            
            const response = await fetch(`${API_URL}/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: message }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Remove thinking message
            removeThinkingMessage(thinkingId);
            
            // Add assistant response
            addMessage('assistant', data.answer, data);
            
            // Store response data globally for JSON download
            window.currentResponseData = {
                query: message,
                timestamp: new Date().toISOString(),
                answer: data.answer,
                sources: data.sources || [],
                raw_data: data
            };
            
            // Add download button for regular responses too
            addDownloadButtonForResponse(message);
            
            // Save to history
            saveChatToHistory(message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        removeThinkingMessage(thinkingId);
        
        if (error.name === 'AbortError') {
            addMessage('assistant', '⏱️ The search took too long. Please try a simpler question or try again.');
        } else {
            addMessage('assistant', `❌ Sorry, I encountered an error: ${error.message}. Please check if the backend server is running.`);
        }
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    input.focus();
}

// Send Example
function sendExample(text) {
    document.getElementById('messageInput').value = text;
    sendMessage();
}

// Add Message
function addMessage(role, content, data = null) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatar = role === 'user' ? 'Y' : 'N';
    const author = role === 'user' ? 'You' : 'Nexus AI';
    
    let statusBadges = '';
    let sourcesHtml = '';
    
    if (data) {
        // Add status badges
        if (data.method === 'web') {
            statusBadges += `<div class="status-badge searching">🌐 Web Search</div>`;
        }
        if (data.method === 'ollama') {
            statusBadges += `<div class="status-badge success">🧠 Mistral AI</div>`;
        }
        
        // Add sources
        if (data.sources && data.sources.length > 0) {
            sourcesHtml = `
                <div class="sources">
                    <div class="sources-title">📚 Sources:</div>
                    ${data.sources.slice(0, 5).map((source, i) => {
                        // Handle both string URLs and source objects
                        const link = typeof source === 'string' ? source : source.link;
                        const title = typeof source === 'string' ? '' : source.title;
                        const snippet = typeof source === 'string' ? '' : source.snippet;
                        
                        try {
                            const domain = new URL(link).hostname;
                            const isWikipedia = domain.includes('wikipedia');
                            const icon = isWikipedia ? '📚' : '🔗';
                            const displayTitle = title ? title.substring(0, 60) + (title.length > 60 ? '...' : '') : domain;
                            
                            return `
                                <a href="${link}" target="_blank" class="source-link" title="${snippet || title}">
                                    <span class="source-icon">${icon}</span>
                                    <span class="source-title">${displayTitle}</span>
                                </a>
                            `;
                        } catch {
                            return '';
                        }
                    }).join('')}
                </div>
            `;
        }
    }
    
    // Format content with markdown support (bold, lists, separators, tables, images)
    let formattedContent = content;
    
    // Convert **text** to <strong>text</strong>
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert --- separator to <hr>
    formattedContent = formattedContent.replace(/\n---\n/g, '<hr class="content-separator">');
    
    // Detect if query is about products (laptops, cars, phones, etc.)
    const questionLower = content.toLowerCase();
    const isProductQuery = /laptop|car|phone|smartphone|vehicle|computer|bike|camera|watch|gadget|device|product/i.test(questionLower);
    
    // Split into paragraphs and preserve numbered lists/tables
    formattedContent = formattedContent
        .split('\n\n')
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => {
            // Check if it's a numbered list block (for table conversion)
            if (/^\d+\.\s/.test(para)) {
                const listItems = para.split('\n')
                    .filter(line => line.trim().length > 0);
                
                // If it's a "Quick List" with 3+ items, convert to product cards for products, table for others
                if (listItems.length >= 3) {
                    // For product queries, use card layout (like ChatGPT)
                    if (isProductQuery) {
                        const productCards = listItems.map(line => {
                            const match = line.match(/^(\d+)\.\s*(.+)$/);
                            if (match) {
                                const itemName = match[2].trim();
                                const itemNumber = match[1];
                                
                                // Extract main product name and details
                                const cleanName = itemName.split('(')[0].split('-')[0].split(':')[0].split('at Rs')[0].trim();
                                const imageUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(cleanName)}`;
                                
                                // Extract price if available
                                const priceMatch = itemName.match(/(?:Rs\.?\s*|₹\s*)(\d+(?:,\d+)*(?:\.\d+)?)/i);
                                const price = priceMatch ? `₹${priceMatch[1]}` : '';
                                
                                return `
                                    <div class="product-card">
                                        <div class="product-image-container">
                                            <img src="${imageUrl}" alt="${cleanName}" class="product-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=${encodeURIComponent(cleanName)}'">
                                            <div class="product-badge">#${itemNumber}</div>
                                        </div>
                                        <div class="product-details">
                                            <h3 class="product-name">${itemName}</h3>
                                            ${price ? `<p class="product-price">${price}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        }).join('');
                        
                        return `<div class="product-grid">${productCards}</div>`;
                    } else {
                        // For non-products, use table format
                        const tableRows = listItems.map(line => {
                            const match = line.match(/^(\d+)\.\s*(.+)$/);
                            if (match) {
                                return `
                                    <tr>
                                        <td class="table-number">${match[1]}</td>
                                        <td class="table-content">
                                            <span class="table-text">${match[2].trim()}</span>
                                        </td>
                                    </tr>
                                `;
                            }
                            return '';
                        }).join('');
                        
                        return `
                            <div class="answer-table-container">
                                <table class="answer-table">
                                    <tbody>${tableRows}</tbody>
                                </table>
                            </div>
                        `;
                    }
                } else {
                    // Small list, keep as ordered list
                    const listHtml = listItems.map(line => {
                        return line.replace(/^(\d+)\.\s*(.+)$/, '<li>$2</li>');
                    }).join('');
                    return `<ol class="answer-list">${listHtml}</ol>`;
                }
            }
            // Regular paragraph
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
        })
        .join('');
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <div class="message-author">${author}</div>
            <div class="message-time">${time}</div>
        </div>
        <div class="message-content">
            ${statusBadges}
            ${formattedContent}
            ${sourcesHtml}
        </div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Add Thinking Message
function addThinkingMessage() {
    const messagesDiv = document.getElementById('messages');
    const thinkingDiv = document.createElement('div');
    const thinkingId = 'thinking-' + Date.now();
    thinkingDiv.id = thinkingId;
    thinkingDiv.className = 'message assistant';
    
    thinkingDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">N</div>
            <div class="message-author">Nexus AI</div>
        </div>
        <div class="message-content">
            <div class="thinking">
                🧠 Thinking
                <div class="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    
    messagesDiv.appendChild(thinkingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return thinkingId;
}

// Remove Thinking Message
function removeThinkingMessage(thinkingId) {
    const thinkingDiv = document.getElementById(thinkingId);
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
}

// Handle Key Press
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Auto Resize Textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
}

// Save Chat to History
function saveChatToHistory(message) {
    if (!currentChatId) {
        currentChatId = Date.now().toString();
    }
    
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    
    // Check if chat exists
    const existingChat = history.find(chat => chat.id === currentChatId);
    
    if (existingChat) {
        existingChat.lastMessage = message;
        existingChat.timestamp = Date.now();
    } else {
        history.unshift({
            id: currentChatId,
            title: message.substring(0, 50),
            lastMessage: message,
            timestamp: Date.now()
        });
    }
    
    // Keep only last 20 chats
    if (history.length > 20) {
        history.pop();
    }
    
    localStorage.setItem('chatHistory', JSON.stringify(history));
    loadChatHistory();
}

// Load Chat History
function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const historyDiv = document.getElementById('chatHistory');
    
    if (history.length === 0) {
        historyDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">
                No chat history yet<br>Start a new conversation!
            </div>
        `;
        return;
    }
    
    historyDiv.innerHTML = history.map(chat => {
        const date = new Date(chat.timestamp);
        const timeAgo = getTimeAgo(date);
        
        return `
            <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" onclick="loadChat('${chat.id}')">
                <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${chat.title}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    ${timeAgo}
                </div>
            </div>
        `;
    }).join('');
}

// Load Chat
function loadChat(chatId) {
    // This would load the chat from a database in a real app
    console.log('Loading chat:', chatId);
    currentChatId = chatId;
    loadChatHistory();
}

// Get Time Ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    
    return date.toLocaleDateString();
}

// Check Backend Status
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            console.log('✅ Backend is running');
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Backend not running. Please start the Flask server.');
        return false;
    }
}

// Detect if query is about products, movies, lists, or data extraction
function detectProductQuery(message) {
    const productKeywords = [
        'laptop', 'car', 'phone', 'smartphone', 'mobile',
        'product', 'buy', 'price', 'best', 'top',
        'under', 'lakh', 'thousand', 'budget',
        'compare', 'review', 'specification', 'specs',
        // MOVIES & ENTERTAINMENT
        'movie', 'movies', 'film', 'films', 'bollywood', 'hollywood',
        'actor', 'actress', 'director', 'cinema',
        // LISTS & DATA
        'list', 'lists', 'cities', 'countries', 'states',
        'names', 'batsman', 'player', 'team',
        // TIME-BASED QUERIES (year ranges, specific years)
        'from', 'to', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020',
        '2021', '2022', '2023', '2024', '2025'
    ];
    
    const messageLower = message.toLowerCase();
    return productKeywords.some(keyword => messageLower.includes(keyword));
}

// Handle product search in chat
async function handleProductSearch(query, thinkingId) {
    try {
        // Update thinking message
        updateThinkingMessage(thinkingId, '🔍 Searching Wikipedia and web for ALL data...');
        
        const response = await fetch(`${API_URL}/scrape_products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                query, 
                limit: 50,  // Get MORE results - 50 pages to extract ALL data
                batch_size: 10  // Larger batches for faster loading
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Product search failed');
        }

        const data = await response.json();

        if (!data.success || !data.batches || data.batches.length === 0) {
            throw new Error('No products found');
        }

        // Collect all products
        const allProducts = [];
        data.batches.forEach(batch => {
            batch.items.forEach(item => {
                allProducts.push(item);
            });
        });

        // Remove thinking message
        removeThinkingMessage(thinkingId);

        // Display products in chat
        displayProductsInChat(allProducts, query);

        // Save to history
        saveChatToHistory(query);

    } catch (error) {
        console.error('Product search error:', error);
        removeThinkingMessage(thinkingId);
        addMessage('assistant', `❌ Sorry, couldn't find products: ${error.message}`);
    }
}

// Display products as chat messages
function displayProductsInChat(products, query) {
    const messagesDiv = document.getElementById('messages');
    
    // Add intro message with download button
    const introHtml = `
        <div class="message assistant-message">
            <div class="message-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <p style="margin: 0;">I found <strong>${products.length} best products</strong> for "<strong>${query}</strong>". Here are the top picks:</p>
                    <button onclick="downloadProductsJSON()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        📥 Download JSON
                    </button>
                </div>
            </div>
        </div>
    `;
    messagesDiv.insertAdjacentHTML('beforeend', introHtml);

    // Store products globally for download
    window.currentProducts = {
        query: query,
        total_results: products.length,
        timestamp: new Date().toISOString(),
        products: products
    };
    
    // Count Wikipedia tables across all products
    let totalTables = 0;
    let totalTableRows = 0;
    products.forEach(product => {
        if (product.wikipedia_tables && product.wikipedia_tables.length > 0) {
            totalTables += product.wikipedia_tables.length;
            product.wikipedia_tables.forEach(table => {
                totalTableRows += table.row_count || 0;
            });
        }
    });

    // Display each product as a card
    products.forEach((product, index) => {
        const productHtml = createProductCard(product, index + 1);
        messagesDiv.insertAdjacentHTML('beforeend', productHtml);
    });

    // Add source footer with Wikipedia table count
    const wikipediaInfo = totalTables > 0 
        ? `<br>📊 <strong>Wikipedia Data:</strong> ${totalTables} tables extracted with ${totalTableRows} total entries!`
        : '';
    
    const footerHtml = `
        <div class="message assistant-message">
            <div class="message-content">
                <p style="color: #8e8ea0; font-size: 13px; margin-top: 20px;">
                    📌 <strong>Sources:</strong> Data collected from Wikipedia, e-commerce websites, and product reviews.${wikipediaInfo}
                    <br>💾 <strong>Tip:</strong> Click "📥 Download JSON" above to get ALL data including complete Wikipedia tables!
                </p>
            </div>
        </div>
    `;
    messagesDiv.insertAdjacentHTML('beforeend', footerHtml);

    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Download products as JSON file
function downloadProductsJSON() {
    if (!window.currentProducts) {
        alert('No product data available to download');
        return;
    }

    // Create JSON string with proper formatting
    const jsonString = JSON.stringify(window.currentProducts, null, 2);
    
    // Create blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename with query and timestamp
    const fileName = `products_${window.currentProducts.query.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    a.download = fileName;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    console.log('✅ JSON file downloaded:', fileName);
}

// Download regular response as JSON
function downloadResponseJSON() {
    if (!window.currentResponseData) {
        alert('No response data available to download');
        return;
    }

    // Create JSON string with proper formatting
    const jsonString = JSON.stringify(window.currentResponseData, null, 2);
    
    // Create blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename with query and timestamp
    const fileName = `response_${window.currentResponseData.query.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    a.download = fileName;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    console.log('✅ JSON file downloaded:', fileName);
}

// Add download button for regular responses
function addDownloadButtonForResponse(query) {
    const messagesDiv = document.getElementById('messages');
    
    const downloadHtml = `
        <div class="message assistant-message" style="margin-top: 8px;">
            <div class="message-content">
                <div style="display: flex; justify-content: flex-end; align-items: center;">
                    <button onclick="downloadResponseJSON()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        📥 Download JSON Response
                    </button>
                </div>
            </div>
        </div>
    `;
    messagesDiv.insertAdjacentHTML('beforeend', downloadHtml);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Create product card HTML - ChatGPT style
function createProductCard(product, number) {
    // Get the best image available
    let mainImage = null;
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        // Find first valid image
        for (let img of product.images) {
            if (img && img.src && img.src.startsWith('http')) {
                mainImage = img.src;
                break;
            }
        }
    }

    // Extract clean title
    const title = product.title || product.search_title || 'Product';
    
    // Get price
    const price = product.price || 'Price not available';
    
    // Extract rating
    const rating = product.rating ? `⭐ ${product.rating}` : '';

    // Build specifications list
    const specs = [];
    
    // Add brand and model if available
    if (product.product_info) {
        if (product.product_info.brand) {
            specs.push(`<strong>Brand:</strong> ${product.product_info.brand}`);
        }
        if (product.product_info.model) {
            specs.push(`<strong>Model:</strong> ${product.product_info.model}`);
        }
        // Add other product info
        Object.entries(product.product_info).forEach(([key, value]) => {
            if (key !== 'brand' && key !== 'model' && value && value.toString().length < 100) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                specs.push(`<strong>${formattedKey}:</strong> ${value}`);
            }
        });
    }

    // Add key features from headings - show MORE features for full explanation
    if (product.headings && product.headings.h2 && product.headings.h2.length > 0) {
        product.headings.h2.slice(0, 8).forEach(heading => {
            if (heading && heading.length > 5 && heading.length < 150) {
                specs.push(`• ${heading}`);
            }
        });
    }
    
    // Add h3 headings for complete details
    if (product.headings && product.headings.h3 && product.headings.h3.length > 0) {
        product.headings.h3.slice(0, 5).forEach(heading => {
            if (heading && heading.length > 5 && heading.length < 150) {
                specs.push(`• ${heading}`);
            }
        });
    }

    // Get FULL description - complete explanation, NO truncation
    let description = '';
    if (product.meta_description) {
        description = product.meta_description;
    } else if (product.paragraphs && product.paragraphs.length > 0) {
        description = product.paragraphs.slice(0, 3).join(' ');
    }

    return `
        <div class="message assistant-message">
            <div class="message-content">
                <div class="product-card-chat">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-right: 12px;">
                            #${number}
                        </span>
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #e7e9ea;">
                            ${title}
                        </h3>
                    </div>
                    
                    ${mainImage ? `
                        <div style="text-align: center; margin: 15px 0; background: #ffffff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <img src="${mainImage}" 
                                 alt="${title}" 
                                 style="max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 40px; color: #8e8ea0; font-size: 14px;\\'>�️ Image not available</div>';">
                        </div>
                    ` : `
                        <div style="text-align: center; margin: 15px 0; background: #2a2f38; border-radius: 12px; padding: 40px;">
                            <div style="font-size: 48px; margin-bottom: 8px;">📦</div>
                            <p style="color: #8e8ea0; font-size: 14px; margin: 0;">Image not available</p>
                        </div>
                    `}
                    
                    <div style="background: #1e2329; border-left: 4px solid #667eea; padding: 12px 16px; border-radius: 8px; margin: 15px 0;">
                        <div style="font-size: 20px; font-weight: 700; color: #10b981; margin-bottom: 4px;">
                            💰 ${price}
                        </div>
                        ${rating ? `<div style="font-size: 14px; color: #fbbf24;">${rating}</div>` : ''}
                    </div>
                    
                    ${description ? `
                        <p style="color: #c9cccf; font-size: 14px; line-height: 1.6; margin: 12px 0;">
                            ${description}
                        </p>
                    ` : ''}
                    
                    ${specs.length > 0 ? `
                        <div style="background: #1e2329; border-radius: 8px; padding: 16px; margin: 15px 0;">
                            <div style="color: #e7e9ea; font-weight: 600; margin-bottom: 10px; font-size: 15px;">
                                📋 Key Specifications:
                            </div>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${specs.map(spec => `
                                    <li style="color: #c9cccf; font-size: 14px; padding: 6px 0; border-bottom: 1px solid #2a2f38;">
                                        ${spec}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <a href="${product.url}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 10px; transition: transform 0.2s;"
                       onmouseover="this.style.transform='translateY(-2px)'"
                       onmouseout="this.style.transform='translateY(0)'">
                        🔗 View Full Details & Buy Now
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Update thinking message text
function updateThinkingMessage(id, text) {
    const thinkingEl = document.getElementById(id);
    if (thinkingEl) {
        const textEl = thinkingEl.querySelector('.thinking-text');
        if (textEl) {
            textEl.textContent = text;
        }
    }
}

// Use quick prompt - auto-fill and send
function useQuickPrompt(prompt) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = prompt;
    
    // Auto-send after a small delay to show the text
    setTimeout(() => {
        sendMessage();
    }, 300);
}

// Voice Input Feature
let recognition = null;
let isListening = false;

function initVoiceRecognition() {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported in this browser');
        return false;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isListening = true;
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.add('listening');
        
        // Update placeholder
        const messageInput = document.getElementById('messageInput');
        messageInput.placeholder = '🎤 Listening... Speak now!';
    };
    
    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
        
        const messageInput = document.getElementById('messageInput');
        messageInput.value = transcript;
        
        // If final result, auto-send
        if (event.results[0].isFinal) {
            setTimeout(() => {
                sendMessage();
            }, 500);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceInput();
        
        if (event.error === 'not-allowed') {
            alert('🎤 Microphone access denied. Please allow microphone access in your browser settings.');
        }
    };
    
    recognition.onend = () => {
        stopVoiceInput();
    };
    
    return true;
}

function toggleVoiceInput() {
    if (!recognition) {
        const supported = initVoiceRecognition();
        if (!supported) {
            alert('🎤 Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }
    }
    
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            stopVoiceInput();
        }
    }
}

function stopVoiceInput() {
    isListening = false;
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.classList.remove('listening');
    
    const messageInput = document.getElementById('messageInput');
    messageInput.placeholder = 'Ask me anything or click 🎤 to speak...';
}

// Initialize backend check
checkBackendStatus();
