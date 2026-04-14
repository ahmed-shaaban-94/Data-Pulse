"""Unit tests for AILightState — append reducers and update semantics."""

from __future__ import annotations

from datapulse.ai_light.graph.state import AILightState


class TestAILightStateAppendReducer:
    def test_step_trace_appends(self):
        state = AILightState({"step_trace": [{"node": "a"}]})
        state.update({"step_trace": [{"node": "b"}]})
        assert len(state["step_trace"]) == 2
        assert state["step_trace"][0]["node"] == "a"
        assert state["step_trace"][1]["node"] == "b"

    def test_errors_appends(self):
        state = AILightState({"errors": ["err1"]})
        state.update({"errors": ["err2"]})
        assert state["errors"] == ["err1", "err2"]

    def test_regular_keys_replace(self):
        state = AILightState({"narrative": "old"})
        state.update({"narrative": "new"})
        assert state["narrative"] == "new"

    def test_empty_initial_step_trace(self):
        state = AILightState({})
        state.update({"step_trace": [{"node": "start"}]})
        assert state["step_trace"] == [{"node": "start"}]

    def test_kwargs_update(self):
        state = AILightState({})
        state.update(insight_type="summary", degraded=False)
        assert state["insight_type"] == "summary"
        assert state["degraded"] is False

    def test_append_key_with_non_list_falls_through(self):
        """If someone passes a non-list for an append key, just set it."""
        state = AILightState({"step_trace": [{"node": "a"}]})
        state.update({"step_trace": "bad_value"})
        # Non-list goes through the regular path (replace)
        assert state["step_trace"] == "bad_value"
