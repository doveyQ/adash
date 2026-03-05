from store import LocalStore
import os

def test_store():
    store = LocalStore("test_agent_state.db")
    
    # Test set/get
    store.set("test_key", {"foo": "bar"})
    val = store.get("test_key")
    assert val == {"foo": "bar"}, f"Expected {{'foo': 'bar'}}, got {val}"
    
    # Test coach history
    store.add_coach_insight(["Insight 1"], "flow_state")
    store.add_coach_insight(["Insight 2"], "distracted")
    history = store.get_coach_history(5)
    assert len(history) == 2, f"Expected 2, got {len(history)}"
    assert history[0] == "Insight 2", f"Expected 'Insight 2', got {history[0]}"
    
    # Test convenience writers
    store.set_system({"cpu_usage": 10.5})
    status = store.get("status")
    assert status["systemStats"]["cpu_usage"] == 10.5
    
    # Cleanup
    if os.path.exists("test_agent_state.db"):
        os.remove("test_agent_state.db")
    print("✅ LocalStore tests passed!")

if __name__ == "__main__":
    test_store()
