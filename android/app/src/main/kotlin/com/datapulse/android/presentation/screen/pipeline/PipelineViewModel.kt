package com.datapulse.android.presentation.screen.pipeline

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.datapulse.android.domain.model.PipelineRun
import com.datapulse.android.domain.model.Resource
import com.datapulse.android.domain.usecase.GetPipelineRunsUseCase
import com.datapulse.android.domain.usecase.TriggerPipelineUseCase
import com.datapulse.android.presentation.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PipelineUiState(
    val runs: UiState<List<PipelineRun>> = UiState.Loading,
    val isTriggering: Boolean = false,
    val triggerError: String? = null,
    val isRefreshing: Boolean = false,
)

@HiltViewModel
class PipelineViewModel @Inject constructor(
    private val getPipelineRuns: GetPipelineRunsUseCase,
    private val triggerPipeline: TriggerPipelineUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(PipelineUiState())
    val state: StateFlow<PipelineUiState> = _state.asStateFlow()

    init { load() }

    fun refresh() {
        _state.value = _state.value.copy(isRefreshing = true)
        load(forceRefresh = true)
    }

    fun trigger() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isTriggering = true, triggerError = null)
            when (val result = triggerPipeline()) {
                is Resource.Success -> {
                    _state.value = _state.value.copy(isTriggering = false)
                    load(forceRefresh = true)
                }
                is Resource.Error -> {
                    _state.value = _state.value.copy(isTriggering = false, triggerError = result.message)
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun clearTriggerError() {
        _state.value = _state.value.copy(triggerError = null)
    }

    private fun load(forceRefresh: Boolean = false) {
        viewModelScope.launch {
            getPipelineRuns(forceRefresh = forceRefresh).collect { resource ->
                _state.value = _state.value.copy(
                    runs = when (resource) {
                        is Resource.Loading -> UiState.Loading
                        is Resource.Success -> if (resource.data.isEmpty()) UiState.Empty else UiState.Success(resource.data, resource.fromCache)
                        is Resource.Error -> UiState.Error(resource.message)
                    },
                    isRefreshing = if (resource !is Resource.Loading) false else _state.value.isRefreshing,
                )
            }
        }
    }
}
