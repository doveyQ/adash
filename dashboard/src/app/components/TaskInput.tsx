"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, X, ListTodo, Loader2, Trash2 } from "lucide-react";

interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export default function TaskInput() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const r = await fetch("/api/tasks", { cache: "no-store" });
      const data = await r.json();
      setTasks(data.tasks ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const id = setInterval(fetchTasks, 30_000);
    return () => clearInterval(id);
  }, [fetchTasks]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask.trim() }),
      });
      setNewTask("");
      await fetchTasks();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: number, completed: boolean) => {
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed: !completed }),
      });
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
      );
    } catch {
      // silent
    }
  };

  const deleteTask = async (id: number) => {
    try {
      await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silent
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  const panelContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99998,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 80,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e: React.MouseEvent) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
              width: 380,
              maxHeight: "70vh",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              padding: 20,
              backgroundColor: "#13131f",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Today's Tasks
                </h3>
                {tasks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/50">
                    {completedCount}/{tasks.length} done
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Add task input */}
            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="What do you need to accomplish?"
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]
                  text-sm text-foreground placeholder:text-muted-foreground/30
                  outline-none focus:border-violet-400/30 transition-colors"
              />
              <button
                onClick={addTask}
                disabled={loading || !newTask.trim()}
                className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 
                  hover:bg-violet-500/30 transition-colors disabled:opacity-30"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/30">
                  <ListTodo className="w-6 h-6 mb-2" />
                  <span className="text-xs">No tasks yet</span>
                  <span className="text-[10px] mt-0.5">
                    Add tasks so the AI coach can track your progress
                  </span>
                </div>
              ) : (
                tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group
                      ${task.completed
                        ? "bg-white/[0.01]"
                        : "bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                  >
                    <button
                      onClick={() => toggleTask(task.id, task.completed)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all
                        ${task.completed
                          ? "border-violet-400/30 bg-violet-400/20"
                          : "border-white/[0.1] hover:border-violet-400/30"
                        }`}
                    >
                      {task.completed && (
                        <Check className="w-3 h-3 text-violet-400" />
                      )}
                    </button>
                    <span
                      className={`text-xs flex-1 transition-all ${task.completed
                        ? "text-muted-foreground/40 line-through"
                        : "text-foreground/80"
                        }`}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 
                        hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-400/60" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* AI context note */}
            <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400/40" />
              <span className="text-[10px] text-muted-foreground/30">
                AI coach will reference these tasks in its insights
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
          text-muted-foreground hover:text-foreground hover:bg-white/[0.04]
          transition-all cursor-pointer border border-white/[0.06]"
        title="Today's tasks"
      >
        <ListTodo className="w-3.5 h-3.5 text-violet-400" />
        <span>
          Tasks
          {tasks.length > 0 && (
            <span className="ml-1 text-muted-foreground/60">
              ({completedCount}/{tasks.length})
            </span>
          )}
        </span>
      </button>

      {mounted && createPortal(panelContent, document.body)}
    </>
  );
}
