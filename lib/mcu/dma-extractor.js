/**
 * DMA Channel/Stream Configuration & Buffer Extractor
 * @module lib/mcu/dma-extractor
 * @version 0.1.0
 *
 * Extracts DMA channel configurations, buffer declarations,
 * and DMA-to-peripheral mappings from .ioc files and source code.
 *
 * Supports: STM32 HAL (DMA1/DMA2 streams), NXP eDMA
 */

const fs = require('fs');
const path = require('path');
const { collectSourceFiles } = require('./isr-extractor');

/**
 * Extract DMA channel/stream configuration from .ioc and source files
 * @param {string|null} iocPath - .ioc file path (null to skip)
 * @param {string} srcDir - source directory
 * @returns {Array<{peripheral: string, stream: number, channel: number, direction: string, mode: string, source: string, file: string, line: number}>}
 */
function extractDMAConfig(iocPath, srcDir) {
  const configs = [];

  // 1. Extract from .ioc
  if (iocPath && fs.existsSync(iocPath)) {
    const content = fs.readFileSync(iocPath, 'utf-8');
    const dmaEntries = new Map();

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Dma.{PERIPH}_{DIR}.{N}.{Property}={Value}
      // e.g., Dma.USART1_RX.0.Direction=DMA_PERIPH_TO_MEMORY
      const dmaMatch = trimmed.match(/^Dma\.(\w+)\.(\d+)\.(\w+)=(.+)/);
      if (dmaMatch) {
        const [, periph, idx, prop, val] = dmaMatch;
        const key = `${periph}_${idx}`;
        if (!dmaEntries.has(key)) {
          dmaEntries.set(key, {
            peripheral: periph,
            stream: -1,
            channel: -1,
            direction: '',
            mode: 'NORMAL',
          });
        }
        const entry = dmaEntries.get(key);
        switch (prop) {
          case 'Direction': entry.direction = val; break;
          case 'Mode': entry.mode = val; break;
          case 'Instance':
            // Instance=DMA1_Stream5 or DMA1_Channel3
            const streamMatch = val.match(/DMA(\d+)_(?:Stream|Channel)(\d+)/);
            if (streamMatch) {
              entry.stream = parseInt(streamMatch[2], 10);
              entry.channel = parseInt(streamMatch[1], 10);
            }
            break;
          case 'Channel':
            // Channel=DMA_CHANNEL_4
            const chMatch = val.match(/DMA_CHANNEL_(\d+)/);
            if (chMatch) entry.channel = parseInt(chMatch[1], 10);
            break;
        }
      }
    }

    for (const entry of dmaEntries.values()) {
      configs.push({
        ...entry,
        source: 'ioc',
        file: iocPath ? path.relative(srcDir, iocPath) : '',
        line: 0,
      });
    }
  }

  // 2. Extract from source: hdma_*.Init patterns
  const sourceFiles = collectSourceFiles(srcDir);
  const initPatterns = [
    // hdma_usart1_rx.Init.Channel = DMA_CHANNEL_4;
    /(\w+)\.Init\.Channel\s*=\s*DMA_CHANNEL_(\d+)/g,
    // hdma_usart1_rx.Init.Direction = DMA_PERIPH_TO_MEMORY;
    /(\w+)\.Init\.Direction\s*=\s*(DMA_\w+)/g,
    // hdma_usart1_rx.Init.Mode = DMA_CIRCULAR;
    /(\w+)\.Init\.Mode\s*=\s*(DMA_\w+)/g,
  ];

  const sourceEntries = new Map();

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const pattern of initPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const handleName = match[1];
        const line = content.substring(0, match.index).split('\n').length;

        if (!sourceEntries.has(handleName)) {
          sourceEntries.set(handleName, {
            peripheral: handleName.replace(/^hdma_/, '').toUpperCase(),
            stream: -1,
            channel: -1,
            direction: '',
            mode: 'NORMAL',
            source: 'source',
            file: path.relative(srcDir, filePath),
            line,
          });
        }

        const entry = sourceEntries.get(handleName);
        if (match[0].includes('.Channel')) {
          entry.channel = parseInt(match[2], 10);
        } else if (match[0].includes('.Direction')) {
          entry.direction = match[2];
        } else if (match[0].includes('.Mode')) {
          entry.mode = match[2];
        }
      }
    }
  }

  for (const entry of sourceEntries.values()) {
    configs.push(entry);
  }

  return configs;
}

/**
 * Extract DMA buffer declarations and alignment attributes
 * @param {string} srcDir - source directory
 * @returns {Array<{name: string, file: string, line: number, size: number, aligned: boolean, inNoCacheRegion: boolean}>}
 */
function extractDMABuffers(srcDir) {
  const buffers = [];
  const sourceFiles = collectSourceFiles(srcDir);

  // Patterns for DMA buffer identification
  const bufferPatterns = [
    // __ALIGN_BEGIN uint8_t rx_buffer[256] __ALIGN_END;
    /__ALIGN_BEGIN\s+\w+\s+(\w+)\s*\[(\d+)\]/g,
    // uint8_t rx_buffer[256] __attribute__((aligned(32)));
    /(\w+)\s+(\w+)\s*\[(\d+)\]\s*__attribute__\s*\(\(\s*aligned\s*\(\s*(\d+)\s*\)\s*\)\)/g,
    // DMA buffer with comment hint: /* DMA */ uint8_t buffer[N];
    /\/\*\s*DMA\s*\*\/\s*\w+\s+(\w+)\s*\[(\d+)\]/g,
  ];

  // Generic array that might be DMA buffer (name contains dma/rx/tx + buf)
  const heuristicPattern = /(?:volatile\s+)?(?:uint8_t|uint16_t|uint32_t)\s+(\w*(?:dma|rx_?buf|tx_?buf|DMA)\w*)\s*\[(\d+)\]/g;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(srcDir, filePath);
    const seen = new Set();

    // Check for __ALIGN_BEGIN pattern
    const alignBeginPattern = /__ALIGN_BEGIN\s+(\w+)\s+(\w+)\s*\[(\d+)\]/g;
    let match;
    while ((match = alignBeginPattern.exec(content)) !== null) {
      const name = match[2];
      if (seen.has(name)) continue;
      seen.add(name);
      buffers.push({
        name,
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        size: parseInt(match[3], 10),
        aligned: true,
        inNoCacheRegion: content.includes('__attribute__((section(".noncacheable")))'),
      });
    }

    // Check for aligned attribute pattern
    const alignAttrPattern = /(\w+)\s+(\w+)\s*\[(\d+)\]\s*__attribute__\s*\(\(\s*aligned/g;
    while ((match = alignAttrPattern.exec(content)) !== null) {
      const name = match[2];
      if (seen.has(name)) continue;
      seen.add(name);
      buffers.push({
        name,
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        size: parseInt(match[3], 10),
        aligned: true,
        inNoCacheRegion: false,
      });
    }

    // Heuristic: arrays with DMA-related names
    heuristicPattern.lastIndex = 0;
    while ((match = heuristicPattern.exec(content)) !== null) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      buffers.push({
        name,
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        size: parseInt(match[2], 10),
        aligned: false,
        inNoCacheRegion: false,
      });
    }
  }

  return buffers;
}

/**
 * Map DMA channels to peripherals
 * @param {Array} dmaConfig - extractDMAConfig result
 * @param {Object} pinConfig - pin-config extractPeripheralList result (or null)
 * @returns {Array<{dmaStream: number, dmaChannel: number, peripheral: string, direction: string}>}
 */
function mapDMAToPeripherals(dmaConfig, pinConfig) {
  return dmaConfig.map(cfg => ({
    dmaStream: cfg.stream,
    dmaChannel: cfg.channel,
    peripheral: cfg.peripheral,
    direction: cfg.direction,
    mode: cfg.mode,
    source: cfg.source,
  }));
}

module.exports = {
  extractDMAConfig,
  extractDMABuffers,
  mapDMAToPeripherals,
};
