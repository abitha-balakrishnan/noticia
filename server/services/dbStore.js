/**
 * Noticia SIEM - Universal Database Store
 * Dual-engine: Directly operates with Mongoose when MongoDB is connected,
 * or serves queries via in-memory collection cache when running offline.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Log = require('../models/Log');
const Alert = require('../models/Alert');
const BlockedIP = require('../models/BlockedIP');
const ChatHistory = require('../models/ChatHistory');

// In-memory collections
const memStore = {
  users: [],
  logs: [],
  alerts: [],
  blocked_ips: [],
  chat_history: []
};

let idCounter = 1;
const generateId = () => new mongoose.Types.ObjectId().toString();

const isMongooseReady = () => mongoose.connection.readyState === 1;

// Helper to filter in-memory records using basic MongoDB operators
function matchesQuery(doc, query = {}) {
  for (const key of Object.keys(query)) {
    if (key === '$or' && Array.isArray(query.$or)) {
      const orMatched = query.$or.some(subQ => matchesQuery(doc, subQ));
      if (!orMatched) return false;
      continue;
    }
    if (key === '$and' && Array.isArray(query.$and)) {
      const andMatched = query.$and.every(subQ => matchesQuery(doc, subQ));
      if (!andMatched) return false;
      continue;
    }

    const val = doc[key];
    const condition = query[key];

    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if (condition.$regex) {
        const re = new RegExp(condition.$regex, condition.$options || '');
        if (!re.test(String(val || ''))) return false;
      }
      if (condition.$gte !== undefined) {
        const docVal = (val instanceof Date) ? val.getTime() : (typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : val);
        const condVal = (condition.$gte instanceof Date) ? condition.$gte.getTime() : (typeof condition.$gte === 'string' && !isNaN(Date.parse(condition.$gte)) ? new Date(condition.$gte).getTime() : condition.$gte);
        if (docVal < condVal) return false;
      }
      if (condition.$lte !== undefined) {
        const docVal = (val instanceof Date) ? val.getTime() : (typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : val);
        const condVal = (condition.$lte instanceof Date) ? condition.$lte.getTime() : (typeof condition.$lte === 'string' && !isNaN(Date.parse(condition.$lte)) ? new Date(condition.$lte).getTime() : condition.$lte);
        if (docVal > condVal) return false;
      }
      if (condition.$in !== undefined && Array.isArray(condition.$in)) {
        if (!condition.$in.includes(val)) return false;
      }
      if (condition.$ne !== undefined) {
        if (val === condition.$ne) return false;
      }
    } else {
      if (condition !== undefined && String(val) !== String(condition)) {
        return false;
      }
    }
  }
  return true;
}

// Memory Query Builder simulating Mongoose chaining
class MemoryQuery {
  constructor(list) {
    this._data = [...list];
    this._skip = 0;
    this._limit = 0;
    this._sort = null;
  }
  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }
  skip(n) {
    this._skip = n || 0;
    return this;
  }
  limit(n) {
    this._limit = n || 0;
    return this;
  }
  populate() {
    return this;
  }
  lean() {
    return this;
  }
  async exec() {
    let result = [...this._data];
    if (this._sort) {
      const keys = Object.keys(this._sort);
      result.sort((a, b) => {
        for (const k of keys) {
          const dir = this._sort[k] === -1 || this._sort[k] === 'desc' ? -1 : 1;
          const aVal = a[k] instanceof Date ? a[k].getTime() : a[k];
          const bVal = b[k] instanceof Date ? b[k].getTime() : b[k];
          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
        }
        return 0;
      });
    }
    if (this._skip > 0) {
      result = result.slice(this._skip);
    }
    if (this._limit > 0) {
      result = result.slice(0, this._limit);
    }
    return result;
  }
  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

// --- Store API ---
const dbStore = {
  // Users
  users: {
    async findOne(query) {
      if (isMongooseReady()) return User.findOne(query);
      return memStore.users.find(u => matchesQuery(u, query)) || null;
    },
    async findById(id) {
      if (isMongooseReady()) return User.findById(id);
      return memStore.users.find(u => String(u._id) === String(id)) || null;
    },
    async find(query = {}) {
      if (isMongooseReady()) return User.find(query);
      const filtered = memStore.users.filter(u => matchesQuery(u, query));
      return new MemoryQuery(filtered);
    },
    async create(doc) {
      if (isMongooseReady()) return User.create(doc);
      const newDoc = {
        _id: generateId(),
        ...doc,
        createdAt: doc.createdAt || new Date()
      };
      memStore.users.push(newDoc);
      return newDoc;
    },
    async findByIdAndUpdate(id, update, options = {}) {
      if (isMongooseReady()) return User.findByIdAndUpdate(id, update, options);
      const idx = memStore.users.findIndex(u => String(u._id) === String(id));
      if (idx === -1) return null;
      const updated = { ...memStore.users[idx], ...(update.$set || update) };
      memStore.users[idx] = updated;
      return updated;
    },
    async countDocuments(query = {}) {
      if (isMongooseReady()) return User.countDocuments(query);
      return memStore.users.filter(u => matchesQuery(u, query)).length;
    }
  },

  // Logs
  logs: {
    async create(doc) {
      if (isMongooseReady()) return Log.create(doc);
      const newDoc = {
        _id: generateId(),
        ...doc,
        timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
        processed: doc.processed !== undefined ? doc.processed : false,
        createdAt: doc.createdAt || new Date()
      };
      memStore.logs.push(newDoc);
      return newDoc;
    },
    async insertMany(docs) {
      if (isMongooseReady()) return Log.insertMany(docs);
      const created = docs.map(d => ({
        _id: generateId(),
        ...d,
        timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
        processed: d.processed !== undefined ? d.processed : false,
        createdAt: d.createdAt || new Date()
      }));
      memStore.logs.push(...created);
      return created;
    },
    find(query = {}) {
      if (isMongooseReady()) return Log.find(query);
      const filtered = memStore.logs.filter(l => matchesQuery(l, query));
      return new MemoryQuery(filtered);
    },
    async findById(id) {
      if (isMongooseReady()) return Log.findById(id);
      return memStore.logs.find(l => String(l._id) === String(id)) || null;
    },
    async updateMany(query, update) {
      if (isMongooseReady()) return Log.updateMany(query, update);
      let count = 0;
      memStore.logs.forEach(l => {
        if (matchesQuery(l, query)) {
          Object.assign(l, update.$set || update);
          count++;
        }
      });
      return { modifiedCount: count };
    },
    async countDocuments(query = {}) {
      if (isMongooseReady()) return Log.countDocuments(query);
      return memStore.logs.filter(l => matchesQuery(l, query)).length;
    }
  },

  // Alerts
  alerts: {
    async create(doc) {
      if (isMongooseReady()) return Alert.create(doc);
      const newDoc = {
        _id: generateId(),
        ...doc,
        createdAt: doc.createdAt || new Date()
      };
      memStore.alerts.push(newDoc);
      return newDoc;
    },
    find(query = {}) {
      if (isMongooseReady()) return Alert.find(query);
      const filtered = memStore.alerts.filter(a => matchesQuery(a, query));
      return new MemoryQuery(filtered);
    },
    async findById(id) {
      if (isMongooseReady()) return Alert.findById(id);
      return memStore.alerts.find(a => String(a._id) === String(id)) || null;
    },
    async findByIdAndUpdate(id, update, options = {}) {
      if (isMongooseReady()) return Alert.findByIdAndUpdate(id, update, options);
      const idx = memStore.alerts.findIndex(a => String(a._id) === String(id));
      if (idx === -1) return null;
      const updated = { ...memStore.alerts[idx], ...(update.$set || update) };
      memStore.alerts[idx] = updated;
      return updated;
    },
    async countDocuments(query = {}) {
      if (isMongooseReady()) return Alert.countDocuments(query);
      return memStore.alerts.filter(a => matchesQuery(a, query)).length;
    }
  },

  // Blocked IPs
  blockedIPs: {
    async create(doc) {
      if (isMongooseReady()) return BlockedIP.create(doc);
      const newDoc = {
        _id: generateId(),
        ...doc,
        blockedAt: doc.blockedAt || new Date()
      };
      memStore.blocked_ips.push(newDoc);
      return newDoc;
    },
    find(query = {}) {
      if (isMongooseReady()) return BlockedIP.find(query);
      const filtered = memStore.blocked_ips.filter(b => matchesQuery(b, query));
      return new MemoryQuery(filtered);
    },
    async findOne(query) {
      if (isMongooseReady()) return BlockedIP.findOne(query);
      return memStore.blocked_ips.find(b => matchesQuery(b, query)) || null;
    },
    async findById(id) {
      if (isMongooseReady()) return BlockedIP.findById(id);
      return memStore.blocked_ips.find(b => String(b._id) === String(id)) || null;
    },
    async findByIdAndDelete(id) {
      if (isMongooseReady()) return BlockedIP.findByIdAndDelete(id);
      const idx = memStore.blocked_ips.findIndex(b => String(b._id) === String(id));
      if (idx === -1) return null;
      const removed = memStore.blocked_ips.splice(idx, 1)[0];
      return removed;
    },
    async countDocuments(query = {}) {
      if (isMongooseReady()) return BlockedIP.countDocuments(query);
      return memStore.blocked_ips.filter(b => matchesQuery(b, query)).length;
    }
  },

  // Chat History
  chatHistory: {
    async create(doc) {
      if (isMongooseReady()) return ChatHistory.create(doc);
      const newDoc = {
        _id: generateId(),
        ...doc,
        createdAt: doc.createdAt || new Date()
      };
      memStore.chat_history.push(newDoc);
      return newDoc;
    },
    find(query = {}) {
      if (isMongooseReady()) return ChatHistory.find(query);
      const filtered = memStore.chat_history.filter(c => matchesQuery(c, query));
      return new MemoryQuery(filtered);
    },
    async countDocuments(query = {}) {
      if (isMongooseReady()) return ChatHistory.countDocuments(query);
      return memStore.chat_history.filter(c => matchesQuery(c, query)).length;
    }
  },

  // Reset helper for unit/integration testing
  _resetMemoryStore() {
    memStore.users = [];
    memStore.logs = [];
    memStore.alerts = [];
    memStore.blocked_ips = [];
    memStore.chat_history = [];
  }
};

module.exports = dbStore;
